export interface WidgetValidationErrorOptions {
  fields: Record<string, string>;
  message?: string;
}

export class WidgetValidationError extends Error {
  constructor(options: WidgetValidationErrorOptions);
  readonly fields: Record<string, string>;
  static getDetails(error: unknown): WidgetValidationErrorOptions | undefined;
}
