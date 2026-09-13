'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, mkdir, writeFile, rm, readFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PlaygroundExamples } = require('../playground/PlaygroundExamples');
const { WidgetResult } = require('../lib/WidgetResult');

test('playground examples validate and cover all blocks, fields, success behaviors and plain result states', () => {
  const examples = PlaygroundExamples.create(Date.parse('2026-09-13T12:00:00Z'));
  const types = new Set();
  const fields = new Set();
  const behaviors = new Set();
  const tones = new Set();
  const alignments = new Set();
  const decimals = new Set();
  const ids = new Set();

  for (const example of examples) {
    assert.equal(ids.has(example.id), false);
    ids.add(example.id);

    if (example.mode !== 'document') {
      continue;
    }

    const document = new WidgetResult(example.value).toJSON();
    assert.equal(WidgetResult.isDocument(document), true, example.id);

    for (const block of document.blocks) {
      types.add(block.type);

      if (block.type === 'form') {
        behaviors.add(block.onSuccess);

        for (const field of block.fields) {
          fields.add(field.type);
        }
      }

      if (block.type === 'status') {
        tones.add(block.tone || 'neutral');
      }

      if (block.type === 'table') {
        for (const column of block.columns) {
          alignments.add(column.align || 'left');
        }
      }

      if (block.type === 'metric' && block.decimals !== undefined) {
        decimals.add(block.decimals);
      }
    }
  }

  assert.deepEqual([...types].sort(), [
    'actions',
    'form',
    'list',
    'markdown',
    'metric',
    'status',
    'table',
  ]);
  assert.deepEqual([...fields].sort(), ['checkbox', 'date', 'text']);
  assert.deepEqual([...behaviors].sort(), ['clear', 'reset', 'retain']);
  assert.deepEqual([...tones].sort(), ['error', 'neutral', 'success', 'warning']);
  assert.deepEqual([...alignments].sort(), ['center', 'left', 'right']);
  assert.deepEqual([...decimals].sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(
    ids.has('unknown') && ids.has('failure') && ids.has('no-result') && ids.has('truncated'),
  );
});

test('preview server uses exact widget markup and locally supplied Homey CSS/fonts without exposing other OS files', async () => {
  const homeyOS = await mkdtemp(path.join(os.tmpdir(), 'widget-playground-'));
  const widgetRoot = path.join(homeyOS, 'packages/homey-core/www/widgets');
  await mkdir(path.join(widgetRoot, 'css'), { recursive: true });
  await mkdir(path.join(widgetRoot, 'fonts'));
  const css = ':root { --homey-font-scale: 1; }';
  const font = Buffer.from('test-font-bytes');
  await writeFile(path.join(widgetRoot, 'css/homey.widgets.css'), css);
  await writeFile(path.join(widgetRoot, 'fonts/Roboto-Regular.ttf'), font);
  await writeFile(path.join(widgetRoot, 'private.txt'), 'Must not be served');
  const server = spawn(process.execPath, ['scripts/serve-widget-playground.mjs'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, HOMEY_OS_PATH: homeyOS, WIDGET_PLAYGROUND_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const address = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Playground server did not start'));
      }, 5000);
      server.once('error', reject);
      server.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);

        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });
    });
    const response = await fetch(`${address}/homey-widget/css/homey.widgets.css`);
    assert.equal(await response.text(), css);
    assert.equal(response.headers.get('content-type'), 'text/css');
    const fontResponse = await fetch(`${address}/homey-widget/fonts/Roboto-Regular.ttf`);
    assert.deepEqual(Buffer.from(await fontResponse.arrayBuffer()), font);
    assert.equal(fontResponse.headers.get('content-type'), 'font/ttf');
    assert.equal((await fetch(`${address}/homey-widget/private.txt`)).status, 404);
    assert.equal((await fetch(`${address}/homey-widget/js/homey.widgets.js`)).status, 404);

    for (const variant of [
      'script-result',
      'script-result-transparent',
      'script-button',
      'script-button-transparent',
    ]) {
      const preview = await fetch(`${address}/preview/${variant}/index.html`);
      const html = await preview.text();
      assert.ok(html.includes('/homey-widget/css/homey.widgets.css'));
      assert.ok(html.includes('/preview.js'));
      assert.ok(html.includes('src="widget.js"'));
      const widgetCss = await fetch(`${address}/preview/${variant}/widget.css`);
      const authored = await readFile(
        path.resolve(__dirname, '../widgets', variant, 'public/widget.css'),
        'utf8',
      );
      assert.equal(await widgetCss.text(), authored);
    }
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }

    await rm(homeyOS, { recursive: true, force: true });
  }
});
