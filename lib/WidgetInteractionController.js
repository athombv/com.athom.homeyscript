'use strict';

class WidgetInteractionController {
  static contract =
    typeof module !== 'undefined'
      ? require('./WidgetResult').WidgetResult
      : globalThis.WidgetResult;

  constructor({ dispatch, refresh }) {
    this.dispatch = dispatch;
    this.refresh = refresh;
    this.forms = new Map();
    this.listeners = new Set();
    this.running = false;
    this.destroyed = false;
    this.result = null;
    this.fieldRevision = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  updateResult(result) {
    if (this.destroyed) {
      return;
    }

    this.result = result;
    const nextForms = new Map();
    const blocks = WidgetInteractionController.contract.isDocument(result?.value)
      ? result.value.blocks
      : [];

    for (const block of blocks) {
      if (block.type !== 'form') {
        continue;
      }

      const previous = this.forms.get(block.id);
      const fields = new Map();

      for (const field of block.fields) {
        const previousField = previous?.fields.get(field.name);
        const defaultValue = WidgetInteractionController.contract.defaultValue(field);
        const sameType = previousField?.type === field.type;
        const preserveDraft = sameType && previousField.dirty === true;

        fields.set(field.name, {
          type: field.type,
          value: preserveDraft ? previousField.value : defaultValue,
          dirty: preserveDraft && previousField.value !== defaultValue,
          revision: sameType ? previousField.revision : ++this.fieldRevision,
        });
      }

      const retainedErrors = Object.entries(previous?.errors || {}).filter(([name]) => {
        return fields.get(name)?.type === previous.fields.get(name)?.type;
      });
      const errors = Object.fromEntries(retainedErrors);
      nextForms.set(block.id, { definition: block, fields, errors });
    }

    this.forms = nextForms;
    this.notify();
  }

  setValue(formId, name, value) {
    if (this.destroyed) {
      return;
    }

    const form = this.forms.get(formId);
    const field = form?.fields.get(name);

    if (!field) {
      return;
    }

    if (field.value !== value) {
      field.revision = ++this.fieldRevision;
    }

    field.value = value;
    field.dirty = true;
    delete form.errors[name];
    this.notify();
  }

  values(formId) {
    const entries = [...this.forms.get(formId).fields].map(([name, field]) => {
      return [name, field.value];
    });

    return Object.fromEntries(entries);
  }

  async run(actionId, formId) {
    if (this.running || this.destroyed) {
      return { success: true, ignored: true };
    }

    if (!this.result?.updatedAt) {
      return { success: false, error: 'No widget result is available.' };
    }

    const form = this.forms.get(formId);
    const request = { updatedAt: this.result.updatedAt, actionId };

    if (formId !== undefined) {
      if (!form || form.definition.submit.id !== actionId) {
        return { success: false, error: 'Form no longer available.' };
      }

      request.formId = formId;
      request.values = this.values(formId);
      form.errors = WidgetInteractionController.contract.validateValues(
        form.definition,
        request.values,
      );

      if (Object.keys(form.errors).length > 0) {
        this.notify();
        return { success: false, code: 'VALIDATION_ERROR' };
      }
    }

    const definition = JSON.stringify(form?.definition);
    const snapshot = this.result;
    const submittedRevisions = new Map();

    for (const [name, field] of form?.fields || []) {
      submittedRevisions.set(name, field.revision);
    }

    this.running = true;
    this.notify();

    try {
      const result = await this.dispatch(request);

      if (this.destroyed || result.ignored) {
        return { success: true, ignored: true };
      }

      if (result.code === 'STALE_RESULT') {
        await this.refresh();
        return result;
      }

      const current = this.forms.get(formId);
      const formChanged = form && JSON.stringify(current?.definition) !== definition;
      const actionPanelChanged = !form && this.result !== snapshot;

      if (formChanged || actionPanelChanged) {
        return { success: true, ignored: true };
      }

      if (!result.success && result.fieldErrors && current) {
        const applicableErrors = Object.entries(result.fieldErrors).filter(([name, error]) => {
          const field = current.fields.get(name);

          if (!field || typeof error !== 'string') {
            return false;
          }

          // A late response must not attach an old error to a newer edit.
          return (
            field.revision === submittedRevisions.get(name) && field.value === request.values[name]
          );
        });
        current.errors = Object.fromEntries(applicableErrors);
      }

      if (result.success && current) {
        this.applySuccess(current, request.values, submittedRevisions);
      }

      return result;
    } catch (err) {
      if (this.destroyed || this.result !== snapshot) {
        return { success: true, ignored: true };
      }

      return { success: false, error: err.message || 'Could not run the action.' };
    } finally {
      this.running = false;
      this.notify();
    }
  }

  applySuccess(form, submittedValues, submittedRevisions) {
    for (const definition of form.definition.fields) {
      const field = form.fields.get(definition.name);
      const unchangedSinceSubmit =
        field.revision === submittedRevisions.get(definition.name) &&
        field.value === submittedValues[definition.name];

      if (!unchangedSinceSubmit) {
        continue;
      }

      delete form.errors[definition.name];
      const behavior = definition.onSuccess ?? form.definition.onSuccess ?? 'retain';

      if (behavior === 'retain') {
        continue;
      }

      const defaultValue = WidgetInteractionController.contract.defaultValue(definition);
      field.value =
        behavior === 'reset'
          ? defaultValue
          : WidgetInteractionController.contract.emptyValue(definition);
      field.dirty = field.value !== defaultValue;
      field.revision = ++this.fieldRevision;
    }
  }

  destroy() {
    this.destroyed = true;
    this.listeners.clear();
    this.forms.clear();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { WidgetInteractionController };
} else {
  globalThis.WidgetInteractionController = WidgetInteractionController;
}
