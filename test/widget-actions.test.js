'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createScriptApp } = require('./helpers/create-script-app');

function createPanel(argument = '  Office  ') {
  const { app } = createScriptApp({
    code: `return new WidgetResult({ blocks: [{ type: 'actions', buttons: [{ id: 'go', label: 'Go', script: 'Target', argument: ${JSON.stringify(argument)} }] }] });`,
  });
  app.scripts.target = { id: 'target', name: 'Target', version: 2, code: 'return args;' };
  return app;
}

async function request(app) {
  const result = await app.scriptWidgets.run('example');
  return { scriptId: 'example', updatedAt: result.updatedAt, actionId: 'go' };
}

test('every action endpoint resolves cached actions, preserves arguments and hides target returns', async () => {
  for (const widget of [
    'script-result',
    'script-result-transparent',
    'script-button',
    'script-button-transparent',
  ]) {
    const app = createPanel();
    const body = await request(app);
    const panel = app.scriptWidgets.results.get('example');
    const api = require(`../widgets/${widget}/api`);
    const result = await api.runAction({
      homey: { app },
      body: { ...body, script: 'Injected', argument: 'Injected' },
    });
    assert.deepEqual(result, { success: true });
    assert.deepEqual(app.scriptWidgets.results.get('target').value, ['  Office  ']);
    assert.equal(app.scriptWidgets.results.get('example'), panel);
    assert.ok(app.scriptExecution.getLastExecuted('target'));
  }
});

test('empty arguments follow the existing no-arguments behavior', async () => {
  const app = createPanel('');
  const result = await app.scriptWidgets.runAction(await request(app));
  assert.equal(result.success, true);
  assert.deepEqual(app.scriptWidgets.results.get('target').value, []);
});

test('same-millisecond completions have distinct timestamps and stale actions cannot execute', async () => {
  const app = createPanel();
  const body = await request(app);
  app.scriptWidgets.lastResultTime = Date.now() + 1000;
  app.scriptWidgets.record('example', {
    success: true,
    value: app.scriptWidgets.results.get('example').value,
  });
  const newTime = app.scriptWidgets.results.get('example').updatedAt;
  app.scriptWidgets.record('example', {
    success: true,
    value: app.scriptWidgets.results.get('example').value,
  });
  assert.notEqual(app.scriptWidgets.results.get('example').updatedAt, newTime);
  const result = await app.scriptWidgets.runAction(body);
  assert.equal(result.code, 'STALE_RESULT');
  assert.equal(app.scriptWidgets.results.has('target'), false);
});

test('panel changes during target lookup are rechecked before execution', async () => {
  const app = createPanel();
  const body = await request(app);
  const getScript = app.getScript.bind(app);
  app.getScript = async (options) => {
    if (options.id === 'target') {
      app.scriptWidgets.record('example', { success: true, value: 'Changed' });
    }
    return await getScript(options);
  };
  assert.equal((await app.scriptWidgets.runAction(body)).code, 'STALE_RESULT');
  assert.equal(app.scriptWidgets.results.has('target'), false);
});

test('missing, ambiguous, wrong-case and unknown action targets do not execute scripts', async () => {
  for (const scenario of ['missing', 'ambiguous', 'wrong-case', 'action']) {
    const app = createPanel();
    const body = await request(app);
    if (scenario === 'missing') {
      delete app.scripts.target;
    }
    if (scenario === 'ambiguous') {
      app.scripts.other = { ...app.scripts.target, id: 'other' };
    }
    if (scenario === 'wrong-case') {
      app.scripts.target.name = 'target';
    }
    if (scenario === 'action') {
      body.actionId = 'unknown';
    }
    const result = await app.scriptWidgets.runAction(body);
    assert.equal(result.success, false);
    assert.match(result.error, /not found|ambiguous/i);
    assert.equal(app.scriptWidgets.results.has('target'), false);
  }
});

test('actions share the widget execution lock and can recover after target failures', async () => {
  const app = createPanel();
  const body = await request(app);
  const runScript = app.runScript.bind(app);
  let release;
  app.runScript = async (options) => {
    if (options.id === 'target') {
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    return await runScript(options);
  };
  const first = app.scriptWidgets.runAction(body);
  await new Promise(setImmediate);
  const duplicate = await app.scriptWidgets.runAction(body);
  assert.match(duplicate.error, /already running/);
  await assert.rejects(app.scriptWidgets.run('target'), /already running/);
  release();
  assert.equal((await first).success, true);
  app.runScript = runScript;
  app.scripts.target.code = 'throw new Error("Device unavailable");';
  assert.deepEqual(await app.scriptWidgets.runAction(body), {
    success: false,
    error: 'Device unavailable',
  });
  assert.equal(app.scriptWidgets.results.get('target').success, false);
  app.scripts.target.code = 'return 123;';
  assert.deepEqual(await app.scriptWidgets.runAction(body), { success: true });
});

test('ordinary, invalid and deleted source results cannot dispatch actions', async () => {
  const app = createPanel();
  const body = await request(app);
  for (const value of ['Plain', { $homeyscriptResult: 1, blocks: [{ type: 'bad' }] }]) {
    app.scriptWidgets.record('example', { success: true, value });
    body.updatedAt = app.scriptWidgets.results.get('example').updatedAt;
    assert.equal((await app.scriptWidgets.runAction(body)).success, false);
  }
  await app.deleteScript({ id: 'example' });
  assert.equal((await app.scriptWidgets.runAction(body)).success, false);
  assert.equal(app.scriptWidgets.results.has('target'), false);
});
