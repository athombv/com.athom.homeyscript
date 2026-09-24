// Save a second script named "save-away-settings" using away-settings-submit.js.
const saved = global.get('away-settings') || {};
return new WidgetResult({
  blocks: [
    {
      type: 'markdown',
      id: 'intro',
      text: '## Away settings\n\nChoose your settings and press **Save**.',
    },
    {
      type: 'form',
      id: 'away-settings',
      onSuccess: 'retain',
      fields: [
        {
          name: 'note',
          type: 'text',
          label: 'Note',
          defaultValue: saved.note || '',
          required: true,
          onSuccess: 'clear',
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable away mode',
          defaultValue: saved.enabled === true,
        },
        { name: 'until', type: 'date', label: 'Away until', defaultValue: saved.until || null },
      ],
      submit: { id: 'save-away', label: 'Save', script: 'save-away-settings' },
    },
  ],
});
