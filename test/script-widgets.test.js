'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createScriptApp } = require('./helpers/create-script-app');
const resultApi = require('../widgets/script-result/api');
const buttonApi = require('../widgets/script-button/api');

test('reading a fresh result does not run a script', async () => {
  const app = createScriptApp({ code: 'throw new Error("Must not run");' }).app;
  const result = await resultApi.getResult({ homey: { app }, query: { scriptId: 'example' } });

  assert.equal(result.name, 'Example');
  assert.equal(result.result, null);
  assert.equal(app.scripts.example.lastExecuted, undefined);
});

test('button runs saved code with its argument and updates the result widget', async () => {
  const app = createScriptApp().app;
  const result = await buttonApi.runScript({
    homey: { app },
    body: { scriptId: 'example', argument: 'Office', code: 'throw new Error("ignore me");' },
  });

  assert.equal(result.success, true);
  assert.equal(result.value, 'Office');
  assert.equal((await app.scriptWidgets.getResult('example')).result.value, 'Office');
  assert.ok((await app.getScript({ id: 'example' })).lastExecuted.getTime());
});

test('editor and Flow calls capture falsy, list, and missing return values', async () => {
  for (const value of [0, false, '', null, ['Door locked', 'Lights off']]) {
    const app = createScriptApp({ code: `return ${JSON.stringify(value)};` }).app;
    await app.runScript({ ...app.scripts.example, realtime: false });
    const { result } = await app.scriptWidgets.getResult('example');

    assert.equal(result.success, true);
    assert.equal(result.hasValue, true);
    assert.deepEqual(result.value, value);
  }

  const app = createScriptApp({ code: 'return;' }).app;
  await app.runScript(app.scripts.example);
  assert.equal((await app.scriptWidgets.getResult('example')).result.hasValue, false);
});

test('script failures remain failures and replace previous results', async () => {
  const app = createScriptApp({ code: 'return 42;' }).app;
  await app.runScript(app.scripts.example);
  app.scripts.example.code = 'throw new Error("Device unavailable");';

  await assert.rejects(app.runScript(app.scripts.example), /Device unavailable/);
  const { result } = await app.scriptWidgets.getResult('example');
  assert.equal(result.success, false);
  assert.equal(result.error, 'Device unavailable');
  assert.equal((await app.scriptWidgets.run('example', '')).success, false);
});

test('duplicate button requests are blocked and failures release the lock', async () => {
  const app = createScriptApp().app;
  let rejectRun;
  app.runScript = () => {
    return new Promise((resolve, reject) => {
      rejectRun = reject;
    });
  };

  const first = app.scriptWidgets.run('example', '');
  await new Promise(setImmediate);
  await assert.rejects(app.scriptWidgets.run('example', ''), /already running/);
  rejectRun(new Error('Failed'));
  assert.equal((await first).success, false);

  app.runScript = async () => {
    return 'Recovered';
  };
  assert.equal((await app.scriptWidgets.run('example', '')).value, 'Recovered');
});

test('missing scripts and invalid arguments never reach the runner', async () => {
  const app = createScriptApp({ code: 'throw new Error("Must not run");' }).app;

  for (const id of [undefined, 'missing', 'toString', '__proto__']) {
    await assert.rejects(app.scriptWidgets.getResult(id), /Script not found/);
    await assert.rejects(app.scriptWidgets.run(id, ''), /Script not found/);
  }

  await assert.rejects(app.scriptWidgets.run('example', {}), /argument must be text/);
});

test('deletion clears results and an in-flight run cannot recreate the script', async () => {
  const app = createScriptApp().app;
  app.scriptWidgets.record('example', { success: true, value: 42 });
  app.runScript = async () => {
    await app.deleteScript({ id: 'example' });
  };

  await app.scriptWidgets.run('example', '');
  assert.equal(app.scriptWidgets.results.size, 0);
  assert.equal(app.scripts.example, undefined);
});

test('snapshots are bounded, detached, and ignore inline scripts', () => {
  const app = createScriptApp().app;
  const value = { count: 2 };
  app.scriptWidgets.record('example', { success: true, value });
  value.count = 9;
  assert.equal(app.scriptWidgets.results.get('example').value.count, 2);

  app.scriptWidgets.record('example', { success: true, value: 'x'.repeat(20000) });
  assert.equal(app.scriptWidgets.results.get('example').truncated, true);
  assert.ok(app.scriptWidgets.results.get('example').value.length <= 16385);

  app.scriptWidgets.record('inline', { success: true, value: 1 });
  assert.equal(app.scriptWidgets.results.size, 1);

  const circular = {};
  circular.self = circular;
  app.scriptWidgets.record('example', { success: true, value: circular });
  assert.equal(app.scriptWidgets.results.get('example').success, true);
  assert.equal(app.scriptWidgets.results.get('example').hasValue, false);
});

test('completed saved scripts notify widgets after caching, including Flow runs and errors', async () => {
  const app = createScriptApp({ code: 'return 42;' }).app;
  const events = [];
  app.homey.api.realtime = async (event, data) => {
    if (event !== 'script-result-updated') {
      return;
    }

    events.push({ event, data, result: app.scriptWidgets.results.get(data.scriptId) });
  };

  await app.runScript({ ...app.scripts.example, realtime: false });
  app.scripts.example.code = 'throw new Error("Device offline");';
  await assert.rejects(
    app.runScript({ ...app.scripts.example, realtime: false }),
    /Device offline/,
  );
  app.scriptWidgets.record('inline', { success: true, value: 1 });

  assert.equal(events.length, 2);
  assert.deepEqual(events[0].data, { scriptId: 'example' });
  assert.equal(events[0].result.value, 42);
  assert.equal(events[1].result.success, false);
  assert.equal(events[1].result.error, 'Device offline');
});

test('realtime delivery failures do not change script success or its cached result', async () => {
  const app = createScriptApp({ code: 'return 42;' }).app;
  const errors = [];
  app.error = (err) => {
    errors.push(err);
  };
  app.homey.api.realtime = async () => {
    throw new Error('Disconnected');
  };

  const value = await app.runScript({ ...app.scripts.example, realtime: false });
  await new Promise(setImmediate);

  assert.equal(value, 42);
  assert.equal(app.scriptWidgets.results.get('example').value, 42);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Disconnected');
});

test('widget runs record success and failure without per-run settings saves', async () => {
  const { app, writes } = createScriptApp();
  const homey = { app };
  await buttonApi.runScript({ homey, body: { scriptId: 'example', argument: 'Widget' } });
  assert.ok((await app.getScripts()).example.lastExecuted);
  app.scripts.example.code = 'throw new Error("Failed");';
  const result = await buttonApi.runScript({ homey, body: { scriptId: 'example', argument: '' } });
  assert.equal(result.success, false);
  assert.ok((await app.getScripts()).example.lastExecuted);
  assert.equal(writes.length, 0);
  app.scriptExecution.flush();
  assert.deepEqual(
    writes.map((write) => {
      return write.key;
    }),
    ['scriptExecution'],
  );
});
