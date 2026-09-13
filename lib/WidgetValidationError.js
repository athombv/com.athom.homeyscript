'use strict';

const { WidgetResult } = require('./WidgetResult');

class WidgetValidationError extends Error {
  #details;

  constructor(options) {
    WidgetResult.object(options, 'WidgetValidationError', ['fields', 'message']);
    WidgetResult.object(options.fields, 'WidgetValidationError.fields');
    const fields = Object.entries(options.fields);

    WidgetResult.check(
      fields.length > 0 && fields.length <= 32,
      'WidgetValidationError.fields',
      'expected 1–32 field errors',
    );

    for (const [name, message] of fields) {
      WidgetResult.identifier(name, `WidgetValidationError.fields.${name}`);
      WidgetValidationError.validateMessage(message, `WidgetValidationError.fields.${name}`);
    }

    if (options.message !== undefined) {
      WidgetValidationError.validateMessage(options.message, 'WidgetValidationError.message');
    }

    const details = { fields: Object.fromEntries(fields) };

    if (options.message !== undefined) {
      details.message = options.message;
    }

    WidgetResult.check(
      JSON.stringify(details).length <= 16384,
      'WidgetValidationError',
      'field errors are too large',
    );

    super(options.message || 'Please check the form fields.');
    this.name = 'WidgetValidationError';
    this.#details = details;
  }

  get fields() {
    return { ...this.#details.fields };
  }

  static validateMessage(message, path) {
    WidgetResult.text(message, path);
    WidgetResult.check(
      message.trim().length > 0 && message.length <= 1024,
      path,
      'expected nonempty text of at most 1,024 characters',
    );
  }

  static getDetails(error) {
    if (error === null || typeof error !== 'object' || !(#details in error)) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(error.#details));
  }
}

module.exports = { WidgetValidationError };
