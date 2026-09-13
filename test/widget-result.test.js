'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { WidgetResult } = require('../lib/WidgetResult');
const { createScriptApp } = require('./helpers/create-script-app');

const blocks = [
  {
    type: 'table',
    columns: [{ key: 'time', label: 'Time', format: 'relativeTime' }],
    rows: [{ time: '2026-09-12T12:00:00Z' }, { time: null }, {}],
  },
  {
    type: 'list',
    ordered: true,
    items: [
      'Plain',
      {
        text: 'Laundry',
        icon: '🧺',
        secondary: '2026-09-12T12:00:00Z',
        secondaryFormat: 'relativeTime',
      },
    ],
  },
  { type: 'metric', value: 0, label: 'Power', unit: 'W', decimals: 2 },
  { type: 'status', text: 'Ready', tone: 'success', description: 'All set' },
  { type: 'actions', buttons: [{ id: 'run', label: 'Run', script: 'Target', argument: 'Office' }] },
  { type: 'markdown', text: '**Home** summary' },
];

test('WidgetResult is available in real scripts and serializes a detached versioned document', async () => {
  const { app } = createScriptApp({
    code: `return new WidgetResult(${JSON.stringify({ blocks })});`,
  });
  const result = await app.scriptWidgets.run('example');
  assert.equal(result.success, true);
  assert.deepEqual(result.value, { $homeyscriptResult: 1, blocks });
  assert.equal(result.updatedAt, app.scriptWidgets.results.get('example').updatedAt);
  assert.equal(WidgetResult.isDocument(result.value), true);

  const options = { blocks: [{ type: 'metric', value: 0 }] };
  const document = new WidgetResult(options);
  options.blocks[0].value = 1;
  assert.equal(JSON.parse(JSON.stringify(document)).blocks[0].value, 0);
});

test('validation errors identify invalid nested fields', () => {
  const invalid = [
    [{ blocks: null }, 'blocks'],
    [{ blocks: [{ type: 'markdown' }] }, 'blocks[0].text'],
    [{ blocks: [{ type: 'markdown', text: 42 }] }, 'blocks[0].text'],
    [{ blocks: [{ type: 'markdown', text: 'Hi', html: true }] }, 'blocks[0].html'],
    [{ blocks: [{ type: 'unknown' }] }, 'blocks[0].type'],
    [{ blocks: [{ type: 'metric', value: Infinity }] }, 'blocks[0].value'],
    [{ blocks: [{ type: 'metric', value: 1, decimals: 7 }] }, 'blocks[0].decimals'],
    [{ blocks: [{ type: 'status', text: 'Fine', tone: 'blue' }] }, 'blocks[0].tone'],
    [{ blocks: [{ type: 'status', text: 'Fine', html: '<b>no</b>' }] }, 'blocks[0].html'],
    [{ blocks: [{ ...blocks[0], rows: [{ time: 'yesterday' }] }] }, 'blocks[0].rows[0].time'],
    [{ blocks: [{ type: 'table', columns: [], rows: [] }] }, 'blocks[0].columns'],
    [
      { blocks: [{ type: 'list', items: [{ text: 'Hi', secondary: 1 }] }] },
      'blocks[0].items[0].secondary',
    ],
    [
      {
        blocks: [
          { type: 'actions', buttons: [{ id: 'a', label: 'Go', script: 'Target', argument: {} }] },
        ],
      },
      'blocks[0].buttons[0].argument',
    ],
    [{ blocks: [blocks[4], blocks[4]] }, 'blocks[1].buttons[0].id'],
  ];
  for (const [options, field] of invalid) {
    assert.throws(
      () => {
        new WidgetResult(options);
      },
      (error) => {
        return error instanceof TypeError && error.message.startsWith(`${field}:`);
      },
    );
  }
});

test('ordinary objects and unsupported or malformed documents are not structured results', () => {
  for (const value of [
    null,
    0,
    false,
    [],
    { blocks },
    { $homeyscriptResult: 99, blocks },
    { $homeyscriptResult: 1, blocks: [{ type: 'bad' }] },
  ]) {
    assert.equal(WidgetResult.isDocument(value), false);
  }
  assert.equal(WidgetResult.isDocument(new WidgetResult({ blocks: [] }).toJSON()), true);
});

test('oversized documents retain the normal bounded text fallback', async () => {
  const { app } = createScriptApp({
    code: "return new WidgetResult({ blocks: [{ type: 'status', text: 'x'.repeat(20000) }] });",
  });
  const result = await app.scriptWidgets.run('example');
  assert.equal(result.success, true);
  assert.equal(result.truncated, true);
  assert.equal(typeof result.value, 'string');
  assert.ok(result.value.length <= 16385);
});

test('validation and renderer assets are identical in all four widgets and wired into their HTML', () => {
  const widgets = [
    'script-result',
    'script-result-transparent',
    'script-button',
    'script-button-transparent',
  ];
  const root = path.resolve(__dirname, '..');
  for (const widget of widgets) {
    const directory = path.join(root, 'widgets', widget, 'public');
    assert.equal(
      fs.readFileSync(path.join(directory, 'widget-result.js'), 'utf8'),
      fs.readFileSync(path.join(root, 'lib/WidgetResult.js'), 'utf8'),
    );
    for (const asset of [
      'result-renderer.js',
      'result-renderer.css',
      'widget-markdown.js',
      'widget-markdown.LICENSE.txt',
      'widget-controller.js',
      'widget-host.js',
    ]) {
      const sources = {
        'result-renderer.js': 'widget-renderer/ResultRenderer.js',
        'result-renderer.css': 'widget-renderer/ResultRenderer.css',
        'widget-controller.js': 'lib/WidgetInteractionController.js',
        'widget-host.js': 'widget-renderer/WidgetHost.js',
      };
      const source = sources[asset] || path.join('widgets/script-result/public', asset);
      assert.equal(
        fs.readFileSync(path.join(directory, asset), 'utf8'),
        fs.readFileSync(path.join(root, source), 'utf8'),
      );
    }
    const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
    for (const asset of ['widget-controller.js', 'widget-host.js']) {
      assert.ok(html.indexOf(`src="${asset}"`) > 0);
      assert.ok(html.indexOf(`src="${asset}"`) < html.indexOf('src="result-renderer.js"'));
    }
    assert.ok(html.indexOf('src="widget-markdown.js"') > 0);
    assert.ok(html.indexOf('src="widget-markdown.js"') < html.indexOf('src="result-renderer.js"'));
    assert.ok(html.indexOf('src="widget-result.js"') < html.indexOf('src="result-renderer.js"'));
    assert.ok(html.indexOf('src="result-renderer.js"') < html.indexOf('src="widget.js"'));
    assert.ok(html.includes('href="result-renderer.css"'));
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'widgets', widget, 'widget.compose.json')),
    );
    assert.equal(manifest.api.runAction.path, '/action');
    assert.equal(
      manifest.settings.some((setting) => {
        return setting.id === 'unit';
      }),
      false,
    );
  }
});

test('zone example preserves parent-first sibling order without indentation', async () => {
  const code = fs.readFileSync(path.resolve(__dirname, '../examples/zone-activity.js'), 'utf8');
  const { app } = createScriptApp({ code });
  app.getHomeyAPI = () => {
    return {
      destroy() {},
      zones: {
        async getZones() {
          return {
            child: { id: 'child', name: 'Desk', parent: 'office', sortIndex: 0, active: false },
            office: {
              id: 'office',
              name: 'Office',
              parent: 'home',
              sortIndex: 2,
              active: false,
              activeLastUpdated: '2026-09-12T12:00:00Z',
            },
            kitchen: { id: 'kitchen', name: 'Kitchen', parent: 'home', sortIndex: 1, active: true },
            home: { id: 'home', name: 'Home', parent: null, sortIndex: null, active: true },
          };
        },
      },
    };
  };
  const result = await app.scriptWidgets.run('example');
  assert.equal(result.success, true);
  const table = result.value.blocks[0];
  assert.equal(table.showHeaders, false);
  assert.deepEqual(table.rows, [
    { zone: '🟢 Home', lastActive: null },
    { zone: '🟢 Kitchen', lastActive: null },
    { zone: '💤 Office', lastActive: '2026-09-12T12:00:00.000Z' },
    { zone: '⚪ Desk', lastActive: null },
  ]);
});
