'use strict';

// This definition is also served to widgets so validation has one contract.
class WidgetResult {
  constructor(options) {
    WidgetResult.validate(options);
    this.blocks = JSON.parse(JSON.stringify(options.blocks));
  }

  toJSON() {
    const extended = this.blocks.some((block) => {
      return block.type === 'form' || block.id !== undefined;
    });

    return { $homeyscriptResult: extended ? 2 : 1, blocks: this.blocks };
  }

  static isDocument(value) {
    if (!value || ![1, 2].includes(value.$homeyscriptResult)) {
      return false;
    }

    try {
      WidgetResult.object(value, 'result', ['$homeyscriptResult', 'blocks']);
      WidgetResult.validate({ blocks: value.blocks });
      if (
        value.$homeyscriptResult === 1 &&
        value.blocks.some((block) => {
          return block.type === 'form' || block.id !== undefined;
        })
      ) {
        return false;
      }

      return true;
    } catch (err) {
      return false;
    }
  }

  static validate(options) {
    WidgetResult.object(options, 'result', ['blocks']);
    WidgetResult.array(options.blocks, 'blocks');
    const actionIds = new Set();
    const blockIds = new Set();

    for (const [index, block] of options.blocks.entries()) {
      const path = `blocks[${index}]`;

      if (block?.id !== undefined) {
        WidgetResult.identifier(block.id, `${path}.id`);
        WidgetResult.check(!blockIds.has(block.id), `${path}.id`, 'duplicate block id');
        blockIds.add(block.id);
      }

      switch (block?.type) {
        case 'form':
          WidgetResult.form(block, path, actionIds);
          break;
        case 'markdown':
          WidgetResult.object(block, path, ['type', 'text']);
          WidgetResult.text(block.text, `${path}.text`);
          break;
        case 'table':
          WidgetResult.table(block, path);
          break;
        case 'list':
          WidgetResult.list(block, path);
          break;
        case 'metric':
          WidgetResult.object(block, path, ['type', 'value', 'label', 'unit', 'decimals']);
          WidgetResult.check(
            Number.isFinite(block.value),
            `${path}.value`,
            'expected a finite number',
          );
          WidgetResult.optionalText(block.label, `${path}.label`);
          WidgetResult.optionalText(block.unit, `${path}.unit`);
          if (block.decimals !== undefined) {
            WidgetResult.check(
              Number.isInteger(block.decimals) && block.decimals >= 0 && block.decimals <= 6,
              `${path}.decimals`,
              'expected an integer from 0 to 6',
            );
          }

          break;
        case 'status':
          WidgetResult.object(block, path, ['type', 'text', 'description', 'icon', 'tone']);
          WidgetResult.text(block.text, `${path}.text`);
          WidgetResult.optionalText(block.description, `${path}.description`);
          WidgetResult.optionalText(block.icon, `${path}.icon`);
          WidgetResult.choice(block.tone, `${path}.tone`, [
            'neutral',
            'success',
            'warning',
            'error',
          ]);
          break;
        case 'actions':
          WidgetResult.object(block, path, ['type', 'buttons']);
          WidgetResult.array(block.buttons, `${path}.buttons`);
          for (const [buttonIndex, button] of block.buttons.entries()) {
            WidgetResult.action(button, `${path}.buttons[${buttonIndex}]`, actionIds);
          }

          break;
        default:
          throw new TypeError(`${path}.type: unknown block type`);
      }
    }
  }

  static identifier(value, path) {
    WidgetResult.check(
      typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value),
      path,
      'expected 1–64 letters, digits, underscores or hyphens, starting with a letter',
    );
  }

  static action(button, path, actionIds) {
    WidgetResult.object(button, path, ['id', 'label', 'script', 'argument']);
    for (const key of ['id', 'label', 'script']) {
      WidgetResult.text(button[key], `${path}.${key}`);
      WidgetResult.check(button[key].trim().length > 0, `${path}.${key}`, 'must not be empty');
    }

    WidgetResult.optionalText(button.argument, `${path}.argument`);
    WidgetResult.check(!actionIds.has(button.id), `${path}.id`, 'duplicate action id');
    actionIds.add(button.id);
  }

  static form(block, path, actionIds) {
    WidgetResult.object(block, path, ['type', 'id', 'fields', 'submit', 'onSuccess']);
    WidgetResult.choice(block.onSuccess, `${path}.onSuccess`, ['retain', 'clear', 'reset']);
    WidgetResult.identifier(block.id, `${path}.id`);
    WidgetResult.array(block.fields, `${path}.fields`);
    WidgetResult.check(
      block.fields.length > 0 && block.fields.length <= 32,
      `${path}.fields`,
      'expected 1–32 fields',
    );
    const names = new Set();

    for (const [index, field] of block.fields.entries()) {
      const fieldPath = `${path}.fields[${index}]`;
      WidgetResult.object(field, fieldPath, [
        'name',
        'type',
        'label',
        'defaultValue',
        'required',
        'onSuccess',
      ]);
      WidgetResult.choice(field.onSuccess, `${fieldPath}.onSuccess`, ['retain', 'clear', 'reset']);
      WidgetResult.identifier(field.name, `${fieldPath}.name`);
      WidgetResult.check(!names.has(field.name), `${fieldPath}.name`, 'duplicate field name');
      names.add(field.name);
      WidgetResult.check(
        ['text', 'checkbox', 'date'].includes(field.type),
        `${fieldPath}.type`,
        'expected text, checkbox or date',
      );
      WidgetResult.text(field.label, `${fieldPath}.label`);
      WidgetResult.check(field.label.trim().length > 0, `${fieldPath}.label`, 'must not be empty');
      WidgetResult.optionalBoolean(field.required, `${fieldPath}.required`);
      if (field.defaultValue !== undefined) {
        WidgetResult.check(
          !WidgetResult.fieldError({ ...field, required: false }, field.defaultValue),
          `${fieldPath}.defaultValue`,
          'invalid default value',
        );
      }
    }

    WidgetResult.action(block.submit, `${path}.submit`, actionIds);
  }

  static defaultValue(field) {
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    return WidgetResult.emptyValue(field);
  }

  static emptyValue(field) {
    if (field.type === 'checkbox') {
      return false;
    }

    return field.type === 'date' ? null : '';
  }

  static fieldError(field, value) {
    if (field.type === 'checkbox') {
      if (typeof value !== 'boolean') {
        return 'Expected a checkbox value.';
      }

      if (field.required && !value) {
        return 'This checkbox is required.';
      }

      return null;
    }

    if (field.type === 'text') {
      if (typeof value !== 'string') {
        return 'Expected text.';
      }

      if (value.length > 4096) {
        return 'Use at most 4,096 characters.';
      }

      if (field.required && !value.trim()) {
        return 'This field is required.';
      }

      return null;
    }

    if (value === null) {
      return field.required ? 'Choose a date.' : null;
    }

    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'Choose a valid date.';
    }

    const date = new Date(`${value}T00:00:00Z`);

    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value ||
      value.startsWith('0000')
    ) {
      return 'Choose a valid date.';
    }

    return null;
  }

  static validateValues(form, values) {
    const names = form.fields.map((field) => {
      return field.name;
    });
    WidgetResult.object(values, 'values', names);
    WidgetResult.check(
      JSON.stringify(values).length <= 16384,
      'values',
      'submitted values are too large',
    );
    const errors = [];

    for (const field of form.fields) {
      const error = WidgetResult.fieldError(field, values[field.name]);

      if (error) {
        errors.push([field.name, error]);
      }
    }

    return Object.fromEntries(errors);
  }

  static table(block, path) {
    WidgetResult.object(block, path, ['type', 'columns', 'rows', 'showHeaders']);
    WidgetResult.array(block.columns, `${path}.columns`);
    WidgetResult.check(block.columns.length > 0, `${path}.columns`, 'expected at least one column');
    WidgetResult.array(block.rows, `${path}.rows`);
    WidgetResult.optionalBoolean(block.showHeaders, `${path}.showHeaders`);
    const keys = new Set();

    for (const [index, column] of block.columns.entries()) {
      const columnPath = `${path}.columns[${index}]`;
      WidgetResult.object(column, columnPath, ['key', 'label', 'align', 'format']);
      WidgetResult.text(column.key, `${columnPath}.key`);
      WidgetResult.check(
        column.key.length > 0 && !keys.has(column.key),
        `${columnPath}.key`,
        'expected a unique, nonempty key',
      );
      keys.add(column.key);
      WidgetResult.text(column.label, `${columnPath}.label`);
      WidgetResult.choice(column.align, `${columnPath}.align`, ['left', 'center', 'right']);
      WidgetResult.choice(column.format, `${columnPath}.format`, ['relativeTime']);
    }

    for (const [index, row] of block.rows.entries()) {
      const rowPath = `${path}.rows[${index}]`;
      WidgetResult.object(row, rowPath);
      for (const [key, value] of Object.entries(row)) {
        WidgetResult.primitive(value, `${rowPath}.${key}`);
      }

      for (const column of block.columns) {
        if (column.format === 'relativeTime') {
          const value = Object.hasOwn(row, column.key) ? row[column.key] : null;
          WidgetResult.timestamp(value, `${rowPath}.${column.key}`);
        }
      }
    }
  }

  static list(block, path) {
    WidgetResult.object(block, path, ['type', 'items', 'ordered']);
    WidgetResult.array(block.items, `${path}.items`);
    WidgetResult.optionalBoolean(block.ordered, `${path}.ordered`);

    for (const [index, item] of block.items.entries()) {
      if (typeof item === 'string') {
        continue;
      }

      const itemPath = `${path}.items[${index}]`;
      WidgetResult.object(item, itemPath, ['text', 'icon', 'secondary', 'secondaryFormat']);
      WidgetResult.text(item.text, `${itemPath}.text`);
      WidgetResult.optionalText(item.icon, `${itemPath}.icon`);
      WidgetResult.choice(item.secondaryFormat, `${itemPath}.secondaryFormat`, ['relativeTime']);
      if (item.secondaryFormat === 'relativeTime') {
        WidgetResult.timestamp(item.secondary, `${itemPath}.secondary`);
      } else {
        WidgetResult.optionalText(item.secondary, `${itemPath}.secondary`);
      }
    }
  }

  static timestamp(value, path) {
    if (value == null) {
      return;
    }

    WidgetResult.check(
      typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
        Number.isFinite(Date.parse(value)),
      path,
      'expected an ISO timestamp with a timezone or null',
    );
  }

  static object(value, path, keys) {
    WidgetResult.check(
      value !== null && typeof value === 'object' && !Array.isArray(value),
      path,
      'expected an object',
    );
    if (keys) {
      for (const key of Object.keys(value)) {
        const blockId = key === 'id' && /^blocks\[\d+\]$/.test(path);
        WidgetResult.check(blockId || keys.includes(key), `${path}.${key}`, 'unknown property');
      }
    }
  }

  static array(value, path) {
    WidgetResult.check(Array.isArray(value), path, 'expected an array');
  }

  static text(value, path) {
    WidgetResult.check(typeof value === 'string', path, 'expected text');
  }

  static optionalText(value, path) {
    if (value !== undefined) {
      WidgetResult.text(value, path);
    }
  }

  static optionalBoolean(value, path) {
    WidgetResult.check(
      value === undefined || typeof value === 'boolean',
      path,
      'expected a boolean',
    );
  }

  static choice(value, path, choices) {
    WidgetResult.check(
      value === undefined || choices.includes(value),
      path,
      `expected ${choices.join(', ')}`,
    );
  }

  static primitive(value, path) {
    const valid =
      value == null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      Number.isFinite(value);
    WidgetResult.check(valid, path, 'expected text, a finite number, boolean or null');
  }

  static check(valid, path, message) {
    if (!valid) {
      throw new TypeError(`${path}: ${message}`);
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { WidgetResult };
} else {
  globalThis.WidgetResult = WidgetResult;
}
