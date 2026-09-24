import {
  WidgetResult,
  type FormBlock,
  type WidgetEvent,
  type ScriptAction,
} from '../lib/WidgetResult';
import { WidgetInteractionController } from '../lib/WidgetInteractionController';
import { WidgetValidationError } from '../lib/WidgetValidationError';

const form = {
  type: 'form',
  id: 'away',
  onSuccess: 'retain',
  fields: [
    { name: 'note', type: 'text', label: 'Note', defaultValue: 'Holiday', onSuccess: 'clear' },
    { name: 'enabled', type: 'checkbox', label: 'Enabled', defaultValue: false },
    { name: 'until', type: 'date', label: 'Until', defaultValue: null, onSuccess: 'reset' },
  ],
  submit: { id: 'save', label: 'Save', script: 'save-away' },
} satisfies FormBlock;
const result = new WidgetResult({ blocks: [form, { type: 'markdown', text: '**Ready**' }] });
const controller = new WidgetInteractionController({
  dispatch: async (intent) => {
    return { success: true };
  },
  refresh: async () => {},
});
controller.updateResult({
  success: true,
  updatedAt: new Date().toISOString(),
  value: result.toJSON(),
});
const event: WidgetEvent = {
  type: 'submit',
  formId: 'away',
  actionId: 'save',
  values: { enabled: true },
};

new WidgetResult({
  blocks: [
    {
      type: 'form',
      id: 'bad',
      submit: form.submit,
      fields: [
        // @ts-expect-error Checkbox defaults must be boolean.
        { name: 'enabled', type: 'checkbox', label: 'Enabled', defaultValue: 'yes' },
      ],
    },
  ],
});
const invalidAction: ScriptAction = {
  id: 'save',
  label: 'Save',
  script: 'save',
  // @ts-expect-error Callbacks are not part of the JSON action contract.
  onClick() {},
};
void invalidAction;
void event;

new WidgetValidationError({
  fields: { until: 'Choose a later date.' },
  message: 'Check the date.',
});
// @ts-expect-error Field messages must be text.
new WidgetValidationError({ fields: { until: false } });
// @ts-expect-error Unsupported success behaviors are rejected.
new WidgetResult({ blocks: [{ ...form, onSuccess: 'refresh' }] });
