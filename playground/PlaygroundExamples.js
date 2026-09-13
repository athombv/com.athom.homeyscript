'use strict';

class PlaygroundExamples {
  static create(now = Date.now()) {
    const ago = new Date(now - 9 * 60000).toISOString();
    const later = new Date(now + 2 * 3600000).toISOString();
    const today = new Date(now).toISOString().slice(0, 10);
    const heading = (text) => {
      return { type: 'markdown', text: `### ${text}` };
    };
    const table = {
      type: 'table',
      columns: [
        { key: 'zone', label: 'Zone', align: 'left' },
        { key: 'active', label: 'Active', align: 'center' },
        { key: 'last', label: 'Last activity', align: 'right', format: 'relativeTime' },
      ],
      rows: [
        { zone: '🟢 Living', active: true, last: null },
        { zone: '💤 Entrance', active: false, last: ago },
        { zone: '⚪ Utility', active: false },
      ],
    };
    const actions = {
      type: 'actions',
      buttons: [
        { id: 'refresh', label: '↻ Refresh', script: 'zone-activity' },
        { id: 'lights', label: '💡 Office lights', script: 'set-room-lights', argument: 'Office' },
      ],
    };
    const mixedForm = {
      type: 'form',
      id: 'away',
      onSuccess: 'retain',
      fields: [
        {
          name: 'note',
          type: 'text',
          label: 'Note (clears after success)',
          defaultValue: 'Holiday',
          required: true,
          onSuccess: 'clear',
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable away mode (retained)',
          defaultValue: false,
        },
        {
          name: 'until',
          type: 'date',
          label: 'Away until (resets to today)',
          defaultValue: today,
          required: true,
          onSuccess: 'reset',
        },
      ],
      submit: { id: 'save-away', label: 'Save', script: 'save-away-settings' },
    };
    const forms = [heading('Per-field overrides'), mixedForm];

    for (const behavior of ['retain', 'clear', 'reset']) {
      forms.push(heading(`Form default: ${behavior}`), {
        type: 'form',
        id: `form-${behavior}`,
        onSuccess: behavior,
        fields: [
          { name: 'text', type: 'text', label: 'Optional text', defaultValue: 'Initial value' },
          {
            name: 'check',
            type: 'checkbox',
            label: 'Required checkbox',
            required: true,
            defaultValue: true,
          },
          { name: 'date', type: 'date', label: 'Optional date' },
        ],
        submit: {
          id: `save-${behavior}`,
          label: `Save (${behavior})`,
          script: 'save-settings',
          argument: behavior,
        },
      });
    }

    const metrics = [
      heading('Default formatting'),
      { type: 'metric', value: 1234.567 },
      { type: 'metric', value: 0, label: 'Zero', unit: 'W' },
      { type: 'metric', value: -5.2, label: 'Outside', unit: '°C', decimals: 1 },
    ];

    for (let decimals = 0; decimals <= 6; decimals += 1) {
      metrics.push({
        type: 'metric',
        value: 1234.56789,
        label: `${decimals} decimal places`,
        decimals,
        unit: 'kWh',
      });
    }

    return [
      {
        id: 'overview',
        label: 'All seven block types',
        mode: 'document',
        value: {
          blocks: [
            {
              type: 'markdown',
              text: '## Home overview\n\nEvery supported block in one panel. Actions are **simulated**.',
            },
            {
              type: 'status',
              text: 'Everything looks good',
              icon: '✅',
              tone: 'success',
              description: 'Updated by your scripts.',
            },
            { type: 'metric', label: 'Current power', value: 460, unit: 'W', decimals: 0 },
            table,
            {
              type: 'list',
              items: [
                'Check the windows',
                {
                  text: 'Next reminder',
                  icon: '🔔',
                  secondary: later,
                  secondaryFormat: 'relativeTime',
                },
              ],
            },
            actions,
            mixedForm,
          ],
        },
      },
      {
        id: 'tables',
        label: 'Tables · headers, alignment, timestamps',
        mode: 'document',
        value: {
          blocks: [
            heading('Headers and column alignment'),
            table,
            heading('No headers'),
            { ...table, showHeaders: false },
            heading('Primitive cells and long labels'),
            {
              type: 'table',
              columns: [
                { key: 'label', label: 'Name' },
                { key: 'value', label: 'Value', align: 'right' },
              ],
              rows: [
                {
                  label: 'A long room name that wraps on narrow screens',
                  value: 'Long text also wraps inside its own column',
                },
                { label: 'Numeric zero', value: 0 },
                { label: 'False', value: false },
                { label: 'Empty', value: null },
              ],
            },
            heading('Empty table'),
            { ...table, rows: [] },
          ],
        },
      },
      {
        id: 'lists',
        label: 'Lists · ordered, icons, secondary text',
        mode: 'document',
        value: {
          blocks: [
            heading('Unordered'),
            {
              type: 'list',
              items: [
                'Plain string',
                { text: 'Object with text only' },
                {
                  text: 'Living room',
                  icon: '🛋️',
                  secondary: 'A longer explanation that wraps across lines.',
                },
                { text: 'Last activity', secondary: ago, secondaryFormat: 'relativeTime' },
                { text: 'Future reminder', secondary: later, secondaryFormat: 'relativeTime' },
                { text: 'No timestamp', secondary: null, secondaryFormat: 'relativeTime' },
              ],
            },
            heading('Ordered'),
            {
              type: 'list',
              ordered: true,
              items: ['Close windows', 'Switch off lights', 'Lock the door'],
            },
            heading('Empty'),
            { type: 'list', items: [] },
          ],
        },
      },
      {
        id: 'metrics',
        label: 'Metrics · labels, units, decimals 0–6',
        mode: 'document',
        value: { blocks: metrics },
      },
      {
        id: 'statuses',
        label: 'Status · all four tones',
        mode: 'document',
        value: {
          blocks: [
            { type: 'status', text: 'Minimal status (default neutral)' },
            ...['neutral', 'success', 'warning', 'error'].map((tone) => {
              return {
                type: 'status',
                tone,
                icon: '●',
                text: `${tone} status`,
                description:
                  'Optional description, with enough text to check wrapping in a narrow widget.',
              };
            }),
          ],
        },
      },
      {
        id: 'markdown',
        label: 'Markdown · all supported elements',
        mode: 'document',
        value: {
          blocks: [
            {
              type: 'markdown',
              text: [
                '# Heading 1',
                '## Heading 2',
                '### Heading 3',
                '#### Heading 4',
                '##### Heading 5',
                '###### Heading 6',
                'Paragraph with **bold**, *emphasis*, `inline code` and a [Homey link](https://homey.app).',
                'A hard line break  \ncontinues here.',
                '> Blockquote with **emphasis**.',
                '- Unordered item\n  - Nested item\n- Another item',
                '3. Ordered list starting at three\n4. Next item',
                '```js\nreturn new WidgetResult({\n  blocks: []\n});\n```',
                '---',
                '[Reference link][homey]\n\n[homey]: https://homey.app "Homey"',
                'Images show alt text: ![Living room camera](https://example.com/image.jpg).',
                'HTML is omitted: <script>alert("ignored")</script>. Unsafe links render as text: [unsafe](javascript:alert(1)).',
              ].join('\n\n'),
            },
          ],
        },
      },
      {
        id: 'actions',
        label: 'Actions · single, wrapping, arguments',
        mode: 'document',
        value: {
          blocks: [
            heading('Single'),
            {
              type: 'actions',
              buttons: [{ id: 'single', label: 'Run script', script: 'example' }],
            },
            heading('Multiple and optional argument'),
            actions,
            heading('Wrapping labels'),
            {
              type: 'actions',
              buttons: [
                {
                  id: 'long',
                  label: 'A longer action label that should wrap within a narrow widget',
                  script: 'example',
                },
                { id: 'empty-arg', label: 'Empty argument', script: 'example', argument: '' },
              ],
            },
            heading('Empty action row'),
            { type: 'actions', buttons: [] },
          ],
        },
      },
      {
        id: 'forms',
        label: 'Forms · every field and success behavior',
        mode: 'document',
        value: { blocks: forms },
      },
      { id: 'empty', label: 'Empty document', mode: 'document', value: { blocks: [] } },
      ...[
        ['text', 'Plain multiline text', 'Hello Homey\nThis is plain text, not **Markdown**.'],
        ['empty-text', 'Empty text', ''],
        ['number', 'Plain number', 460],
        ['boolean', 'Plain boolean', false],
        ['null', 'Null', null],
        ['json', 'Plain JSON object', { home: 'Home', active: true, count: 3 }],
        ['array', 'Plain JSON array', ['Living', 'Office']],
        ['unknown', 'Unsupported document version', { $homeyscriptResult: 99, blocks: [] }],
      ].map(([id, label, value]) => {
        return { id, label, mode: 'value', value };
      }),
      { id: 'no-result', label: 'No cached result', mode: 'snapshot', value: null },
      {
        id: 'no-return',
        label: 'No return value',
        mode: 'snapshot',
        value: { success: true, hasValue: false },
      },
      {
        id: 'failure',
        label: 'Script failed',
        mode: 'snapshot',
        value: { success: false, error: 'Could not reach the thermostat.' },
      },
      {
        id: 'display-error',
        label: 'Unserializable return',
        mode: 'snapshot',
        value: {
          success: true,
          hasValue: false,
          displayError: 'This return value cannot be displayed.',
        },
      },
      {
        id: 'truncated',
        label: 'Truncated result',
        mode: 'snapshot',
        value: {
          success: true,
          hasValue: true,
          value: 'A large result was shortened…',
          truncated: true,
        },
      },
    ];
  }
}

if (typeof module !== 'undefined') {
  module.exports = { PlaygroundExamples };
} else {
  globalThis.PlaygroundExamples = PlaygroundExamples;
}
