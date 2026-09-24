import type {
  ActionIntent,
  ActionResponse,
  FormBlock,
  FormValues,
  ResultSnapshot,
} from './WidgetResult';

export interface FormState {
  definition: FormBlock;
  fields: Map<
    string,
    {
      type: 'text' | 'checkbox' | 'date';
      value: string | boolean | null;
      dirty: boolean;
      revision: number;
    }
  >;
  errors: Record<string, string>;
}
export class WidgetInteractionController {
  constructor(adapter: {
    dispatch(intent: ActionIntent): Promise<ActionResponse>;
    refresh(): Promise<void>;
  });
  forms: Map<string, FormState>;
  running: boolean;
  result: ResultSnapshot | null;
  subscribe(listener: () => void): () => void;
  updateResult(result: ResultSnapshot | null): void;
  setValue(formId: string, name: string, value: string | boolean | null): void;
  values(formId: string): FormValues;
  run(actionId: string, formId?: string): Promise<ActionResponse>;
  destroy(): void;
}
