'use strict';

class WidgetResultRenderer {
  constructor({ output, controller }) {
    this.output = output;
    this.controller = controller;
    this.formViews = new Map();
    this.unsubscribe = controller.subscribe(() => {
      this.syncForms();
    });
    this.times = [];
    this.buttons = [];
    this.pageHidden = false;
    this.destroyed = false;
    this.timer = null;
    this.feedbackTimer = null;
    this.signature = null;
    this.onVisibility = () => {
      this.scheduleTimes();
      if (document.hidden) {
        this.clearError();
      }
    };

    this.onPageHide = () => {
      this.pageHidden = true;
      this.stopTimers();
    };

    this.onPageShow = () => {
      this.pageHidden = false;
      this.scheduleTimes();
    };

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
  }

  destroy() {
    this.destroyed = true;
    this.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    this.clear({ resetController: false });
  }

  stopTimers() {
    clearInterval(this.timer);
    this.clearError();
    this.timer = null;
  }

  clear({ resetController = true } = {}) {
    if (resetController) {
      this.controller.updateResult(null);
    }

    this.formViews.clear();
    this.stopTimers();
    this.times = [];
    this.buttons = [];
    this.feedback = null;
    this.signature = null;
    this.output.replaceChildren();
    this.output.className = 'homey-text-regular';
  }

  render(result) {
    if (this.destroyed) {
      return;
    }

    const signature = JSON.stringify(result);

    // Polling the same snapshot must not remove focus or execution feedback.
    if (signature === this.signature) {
      return;
    }

    this.stopTimers();
    this.times = [];
    this.buttons = [];
    this.controller.updateResult(result);
    if (this.formViews.size === 0) {
      this.output.replaceChildren();
    }

    this.signature = signature;
    if (!result?.hasValue) {
      this.formViews.clear();
      this.output.className = 'homey-text-regular';
      this.output.textContent = result?.displayError || 'Script finished without a return value.';
      return;
    }

    const value = result.value;

    if (!globalThis.WidgetResult.isDocument(value)) {
      this.formViews.clear();
      this.output.className = 'homey-text-regular';
      this.output.textContent = WidgetResultRenderer.plainText(value);
      return;
    }

    this.output.classList.add('widget-blocks');
    if (value.blocks.length === 0) {
      this.output.textContent = 'No content';
    }

    const sections = [];
    const forms = new Map();

    for (const block of value.blocks) {
      if (block.type === 'form') {
        const view = this.renderForm(block, this.formViews.get(block.id));
        sections.push(view.element);
        forms.set(block.id, view);
        continue;
      }

      const section = WidgetResultRenderer.element('div', 'widget-block');

      switch (block.type) {
        case 'markdown':
          globalThis.WidgetMarkdown.MarkdownRenderer.render(section, block.text);
          break;
        case 'table':
          this.renderTable(section, block);
          break;
        case 'list':
          this.renderList(section, block);
          break;
        case 'metric':
          this.renderMetric(section, block);
          break;
        case 'status':
          section.classList.add(`widget-tone-${block.tone || 'neutral'}`);
          section.append(
            WidgetResultRenderer.element('p', '', `${block.icon || ''} ${block.text}`.trim()),
          );
          if (block.description) {
            section.append(
              WidgetResultRenderer.element('p', 'widget-secondary', block.description),
            );
          }

          break;
        case 'actions':
          this.renderActions(section, block);
          break;
      }

      sections.push(section);
    }

    WidgetResultRenderer.placeChildren(this.output, sections);
    this.formViews = forms;
    this.syncForms();
    this.scheduleTimes();
  }

  renderTable(section, block) {
    if (block.rows.length === 0) {
      section.textContent = 'No rows';
      return;
    }

    const table = WidgetResultRenderer.element('table', 'widget-table');

    if (block.showHeaders !== false) {
      const head = document.createElement('thead');
      const row = document.createElement('tr');

      for (const column of block.columns) {
        const cell = WidgetResultRenderer.element(
          'th',
          `widget-align-${column.align || 'left'}`,
          column.label,
        );
        cell.scope = 'col';
        row.append(cell);
      }

      head.append(row);
      table.append(head);
    }

    const body = document.createElement('tbody');

    for (const values of block.rows) {
      const row = document.createElement('tr');

      for (const column of block.columns) {
        const cell = WidgetResultRenderer.element('td', `widget-align-${column.align || 'left'}`);
        const value = Object.hasOwn(values, column.key) ? values[column.key] : null;
        this.renderValue(cell, value, column.format);
        row.append(cell);
      }

      body.append(row);
    }

    table.append(body);
    section.append(table);
  }

  renderList(section, block) {
    if (block.items.length === 0) {
      section.textContent = 'No items';
      return;
    }

    const list = WidgetResultRenderer.element(block.ordered ? 'ol' : 'ul', 'widget-list');

    for (const item of block.items) {
      const row = document.createElement('li');

      if (typeof item === 'string') {
        row.textContent = item;
      } else {
        row.append(
          WidgetResultRenderer.element('span', '', `${item.icon || ''} ${item.text}`.trim()),
        );
        if (item.secondary != null) {
          const secondary = WidgetResultRenderer.element('div', 'widget-secondary');
          this.renderValue(secondary, item.secondary, item.secondaryFormat);
          row.append(secondary);
        }
      }

      list.append(row);
    }

    section.append(list);
  }

  renderMetric(section, block) {
    if (block.label) {
      section.append(WidgetResultRenderer.element('p', 'widget-secondary', block.label));
    }

    let options;

    if (block.decimals !== undefined) {
      options = { minimumFractionDigits: block.decimals, maximumFractionDigits: block.decimals };
    }

    const value = block.value.toLocaleString(undefined, options);
    section.append(
      WidgetResultRenderer.element(
        'p',
        'widget-metric',
        `${value}${block.unit ? ` ${block.unit}` : ''}`,
      ),
    );
  }

  renderValue(element, value, format) {
    if (value == null) {
      return;
    }

    if (format === 'relativeTime') {
      const time = document.createElement('time');
      time.dateTime = value;
      time.title = new Date(value).toLocaleString();
      this.times.push({ element: time, timestamp: Date.parse(value) });
      element.append(time);
      return;
    }

    element.textContent = String(value);
  }

  scheduleTimes() {
    clearInterval(this.timer);
    this.timer = null;
    if (document.hidden || this.pageHidden || this.times.length === 0 || this.output.hidden) {
      return;
    }

    this.updateTimes();
    this.timer = setInterval(() => {
      this.updateTimes();
    }, 60000);
  }

  updateTimes() {
    const now = Date.now();

    for (const { element, timestamp } of this.times) {
      element.textContent = WidgetResultRenderer.relativeTime(timestamp, now);
    }
  }

  renderActions(section, block) {
    section.classList.add('widget-actions');
    for (const action of block.buttons) {
      const button = WidgetResultRenderer.element('button', 'widget-action', action.label);
      button.type = 'button';
      button.setAttribute('aria-disabled', String(this.controller.running));
      button.addEventListener('click', () => {
        this.runAction(action.id).catch((err) => {
          this.showError(err.message);
        });
      });
      this.buttons.push(button);
      section.append(button);
    }
  }

  async runAction(actionId, formId) {
    this.clearError();
    const result = await this.controller.run(actionId, formId);

    if (this.destroyed) {
      return;
    }

    if (result.code === 'VALIDATION_ERROR') {
      const view = this.formViews.get(formId);
      const state = this.controller.forms.get(formId);

      for (const [name, field] of view?.fields || []) {
        if (state && Object.hasOwn(state.errors, name)) {
          field.input.focus();
          break;
        }
      }
    }

    if (!result.success && (result.code !== 'VALIDATION_ERROR' || result.error)) {
      this.showError(result.error || 'Action failed');
    }
  }

  renderForm(block, previous) {
    const view = previous || {
      element: WidgetResultRenderer.element('form', 'widget-block widget-form'),
      fields: new Map(),
    };
    view.element.noValidate = true;
    view.definition = block;

    if (!previous) {
      view.element.addEventListener('submit', (event) => {
        event.preventDefault();
        const composing = [...view.fields.values()].some((field) => {
          return field.composing;
        });

        if (composing) {
          return;
        }

        this.runAction(view.definition.submit.id, view.definition.id).catch((err) => {
          this.showError(err.message);
        });
      });
      view.button = WidgetResultRenderer.element('button', 'widget-action');
      view.button.type = 'submit';
    }

    const fields = new Map();
    const children = [];

    for (const field of block.fields) {
      let control = view.fields.get(field.name);

      if (!control || control.type !== field.type) {
        const element = WidgetResultRenderer.element('div', 'widget-field');
        const label = WidgetResultRenderer.element('label', 'widget-field-label');
        const input = document.createElement('input');
        const error = WidgetResultRenderer.element('p', 'widget-field-error');
        input.type = field.type;
        input.id = `widget-field-${block.id.length}-${block.id}-${field.name}`;
        label.htmlFor = input.id;
        error.id = `${input.id}-error`;
        input.setAttribute('aria-describedby', error.id);
        if (field.type === 'text') {
          input.maxLength = 4096;
        }

        if (field.type === 'date') {
          input.min = '0001-01-01';
          input.max = '9999-12-31';
        }

        element.append(label, input, error);
        control = { element, label, input, error, type: field.type, composing: false };
        const current = control;
        const update = () => {
          let value = input.value;

          if (field.type === 'checkbox') {
            value = input.checked;
          }

          if (field.type === 'date' && value === '') {
            value = null;
          }

          this.controller.setValue(block.id, field.name, value);
        };

        input.addEventListener('input', update);
        input.addEventListener('change', update);
        input.addEventListener('compositionstart', () => {
          current.composing = true;
        });
        input.addEventListener('compositionend', () => {
          current.composing = false;
          update();
        });
      }

      control.label.textContent = field.label;
      control.input.required = field.required === true;
      control.element.classList.toggle('widget-field-checkbox', field.type === 'checkbox');
      fields.set(field.name, control);
      children.push(control.element);
    }

    view.fields = fields;
    view.button.textContent = block.submit.label;
    children.push(view.button);
    WidgetResultRenderer.placeChildren(view.element, children);
    return view;
  }

  syncForms() {
    for (const button of this.buttons) {
      button.setAttribute('aria-disabled', String(this.controller.running));
    }

    for (const [id, view] of this.formViews) {
      const state = this.controller.forms.get(id);

      if (!state) {
        continue;
      }

      view.button.setAttribute('aria-disabled', String(this.controller.running));
      for (const [name, control] of view.fields) {
        const field = state.fields.get(name);

        if (!field || field.type !== control.type) {
          continue;
        }

        const textValue = field.value ?? '';
        const updateText = !control.composing && control.input.value !== textValue;

        if (field.type === 'checkbox') {
          control.input.checked = field.value;
        } else if (updateText) {
          control.input.value = textValue;
        }

        const error = Object.hasOwn(state.errors, name) ? state.errors[name] : '';
        control.error.textContent = error;
        control.error.hidden = !error;
        control.input.setAttribute('aria-invalid', String(Boolean(error)));
      }
    }
  }

  static placeChildren(parent, children) {
    const active = document.activeElement;

    for (const [index, child] of children.entries()) {
      if (parent.children[index] !== child) {
        parent.insertBefore(child, parent.children[index] || null);
      }
    }

    for (const child of [...parent.children]) {
      if (!children.includes(child)) {
        child.remove();
      }
    }

    // Moving a retained form may blur its input; restore that same live node.
    if (active?.isConnected && document.activeElement !== active) {
      active.focus({ preventScroll: true });
    }
  }

  clearError() {
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = null;
    this.feedback?.remove();
    this.feedback = null;
  }

  showError(text) {
    this.clearError();
    if (this.destroyed || this.pageHidden || document.hidden) {
      return;
    }

    this.feedback = WidgetResultRenderer.element('p', 'widget-error-toast');
    this.feedback.setAttribute('role', 'alert');
    this.output.append(this.feedback);
    this.feedback.textContent = text;
    this.feedbackTimer = setTimeout(() => {
      this.clearError();
    }, 4000);
  }

  static relativeTime(timestamp, now) {
    const minutes = Math.floor(Math.abs(now - timestamp) / 60000);
    let duration = '<1 min';

    if (minutes >= 1440) {
      duration = `${Math.floor(minutes / 1440)}d ${Math.floor(minutes / 60) % 24}h`;
    } else if (minutes >= 60) {
      duration = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    } else if (minutes >= 1) {
      duration = `${minutes} min`;
    }

    return timestamp > now ? `in ${duration}` : `${duration} ago`;
  }

  static plainText(value) {
    if (value === '') {
      return 'Empty text';
    }

    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  static element(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }
}

window.WidgetResultRenderer = WidgetResultRenderer;
