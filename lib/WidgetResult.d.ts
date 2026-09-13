/** Public JSON contract. Runtime validation is shared by the VM, server and browser. */
import type { WidgetValidationErrorOptions } from './WidgetValidationError';

export interface ScriptAction {
  id: string;
  label: string;
  script: string;
  argument?: string;
}
export type CellValue = string | number | boolean | null;
export type LegacyBlock =
  | { type: 'markdown'; text: string }
  | {
      type: 'status';
      text: string;
      description?: string;
      icon?: string;
      tone?: 'neutral' | 'success' | 'warning' | 'error';
    }
  | {
      type: 'metric';
      value: number;
      label?: string;
      unit?: string;
      decimals?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
  | {
      type: 'table';
      columns: {
        key: string;
        label: string;
        align?: 'left' | 'center' | 'right';
        format?: 'relativeTime';
      }[];
      rows: Record<string, CellValue>[];
      showHeaders?: boolean;
    }
  | {
      type: 'list';
      items: (
        | string
        | ({ text: string; icon?: string } & (
            | { secondary?: string; secondaryFormat?: undefined }
            | { secondary?: string | null; secondaryFormat: 'relativeTime' }
          ))
      )[];
      ordered?: boolean;
    }
  | { type: 'actions'; buttons: ScriptAction[] };
export type SubmitSuccessBehavior = 'retain' | 'clear' | 'reset';
export type FormField = {
  name: string;
  label: string;
  required?: boolean;
  onSuccess?: SubmitSuccessBehavior;
} & (
  | { type: 'text'; defaultValue?: string }
  | { type: 'checkbox'; defaultValue?: boolean }
  | { type: 'date'; defaultValue?: string | null }
);
export interface FormBlock {
  type: 'form';
  id: string;
  fields: FormField[];
  submit: ScriptAction;
  onSuccess?: SubmitSuccessBehavior;
}
export type Block = (LegacyBlock & { id?: string }) | FormBlock;
export interface WidgetResultOptions {
  blocks: Block[];
}
export type WidgetDocument =
  | { $homeyscriptResult: 1; blocks: LegacyBlock[] }
  | { $homeyscriptResult: 2; blocks: Block[] };
export type FormValues = Record<string, string | boolean | null>;
export type WidgetEvent =
  | { type: 'action'; actionId: string }
  | { type: 'submit'; actionId: string; formId: string; values: FormValues };
export interface ActionIntent {
  updatedAt: string;
  actionId: string;
  formId?: string;
  values?: FormValues;
}
export interface ActionResponse {
  success: boolean;
  code?: 'STALE_RESULT' | 'VALIDATION_ERROR';
  error?: string;
  fieldErrors?: Record<string, string>;
  ignored?: boolean;
}
export interface ResultSnapshot {
  success: boolean;
  hasValue?: boolean;
  value?: unknown;
  updatedAt: string;
  error?: string;
  validationError?: WidgetValidationErrorOptions;
}
export class WidgetResult {
  constructor(options: WidgetResultOptions);
  blocks: Block[];
  toJSON(): WidgetDocument;
  static isDocument(value: unknown): value is WidgetDocument;
  static validate(options: unknown): void;
  static validateValues(form: FormBlock, values: unknown): Record<string, string>;
  static defaultValue(field: FormField): string | boolean | null;
  static emptyValue(field: FormField): string | boolean | null;
}
