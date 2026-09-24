'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createScriptApp } = require('./helpers/create-script-app');
const { ScriptExecution } = require('../lib/ScriptExecution');
const editorApi = require('../api');
const { RunAction } = require('../lib/flow/actions/RunAction');
const { RunWithArgAction } = require('../lib/flow/actions/RunWithArgAction');
const { RunCondition } = require('../lib/flow/conditions/RunCondition');
const { RunWithArgCondition } = require('../lib/flow/conditions/RunWithArgCondition');

const previous = '2026-09-12T10:00:00.000Z';
const latest = '2026-09-12T11:00:00.000Z';

function legacySettings() {
  return {
    scripts: {
      example: {
        id: 'example',
        name: 'Example',
        code: 'return 42;',
        version: 2,
        lastExecuted: previous,
      },
      unused: { id: 'unused', name: 'Unused', code: 'return;', version: 2, lastExecuted: null },
    },
  };
}

test('migration preserves timestamps and definitions and is safe to resume after either write', async () => {
  const original = legacySettings();
  const fixture = createScriptApp({ storedSettings: original });
  const { app, settings, writes } = fixture;
  assert.deepEqual(
    writes.map((write) => {
      return write.key;
    }),
    ['scriptExecution', 'scripts'],
  );
  assert.equal(settings.scripts.example.code, 'return 42;');
  assert.equal(Object.hasOwn(settings.scripts.example, 'lastExecuted'), false);
  assert.equal((await app.getScript({ id: 'example' })).lastExecuted.toISOString(), previous);
  assert.equal((await app.getScripts()).unused.lastExecuted, null);

  const interrupted = { ...original, scriptExecution: { example: { lastExecuted: latest } } };
  const resumed = createScriptApp({ storedSettings: interrupted });
  assert.equal((await resumed.app.getScripts()).example.lastExecuted, latest);
  assert.deepEqual(
    resumed.writes.map((write) => {
      return write.key;
    }),
    ['scripts'],
  );

  const restarted = createScriptApp({ storedSettings: settings });
  assert.equal(restarted.writes.length, 0);
  assert.equal((await restarted.app.getScripts()).example.lastExecuted, previous);
});

test('migration does not remove legacy fields when submitting metadata fails', () => {
  const { app, settings } = createScriptApp();
  app.scripts = legacySettings().scripts;
  app.homey.settings.set = () => {
    throw new Error('Save failed');
  };
  const execution = new ScriptExecution(app);
  assert.throws(() => {
    execution.initialize();
  }, /Save failed/);
  assert.equal(app.scripts.example.lastExecuted, previous);
  assert.equal(settings.scriptExecution, undefined);
});

test('frequent executions batch metadata at a fixed deadline without saving code', async () => {
  const { app, writes, advanceTime, timers } = createScriptApp();
  await app.updateScript({ id: 'example', lastExecuted: previous });
  advanceTime(ScriptExecution.SAVE_INTERVAL - 1);
  await app.updateScript({ id: 'example', lastExecuted: latest });
  assert.equal(writes.length, 0);
  assert.equal(timers.size, 1);
  assert.equal((await app.getScripts()).example.lastExecuted, latest);
  assert.equal(app.scripts.example.lastExecuted, undefined);

  advanceTime(1);
  assert.deepEqual(writes, [
    { key: 'scriptExecution', value: { example: { lastExecuted: latest } } },
  ]);
  advanceTime(ScriptExecution.SAVE_INTERVAL * 3);
  assert.equal(writes.length, 1, 'idle periods must not write');
  await app.updateScript({ id: 'example', lastExecuted: latest });
  assert.equal(timers.size, 0, 'unchanged timestamps must not schedule a write');
});

test('script edits and creation save immediately without mixing in execution metadata', async () => {
  const { app, writes, settings } = createScriptApp();
  await app.updateScript({ id: 'example', lastExecuted: previous });
  const edited = await app.updateScript({
    id: 'example',
    name: 'Renamed',
    code: 'return 7;',
    version: 1,
  });
  assert.equal(edited.lastExecuted, previous);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].key, 'scripts');
  assert.equal(settings.scripts.example.code, 'return 7;');
  assert.equal(Object.hasOwn(settings.scripts.example, 'lastExecuted'), false);

  const created = await app.createScript({ name: 'New', code: 'return 1;' });
  assert.equal(created.lastExecuted, null);
  assert.equal(settings.scripts[created.id].code, 'return 1;');
  assert.equal(Object.hasOwn(settings.scripts[created.id], 'lastExecuted'), false);
});

test('editor runs record success and failure without per-run settings saves', async () => {
  const { app, writes } = createScriptApp();
  const homey = { app };
  await editorApi.runScript({ homey, params: { id: 'example' }, body: { args: ['Editor'] } });
  assert.ok((await app.getScripts()).example.lastExecuted);
  app.scripts.example.code = 'throw new Error("Failed");';
  const result = await editorApi.runScript({ homey, params: { id: 'example' } });
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

test('saved-script Flow cards preserve results, arguments, and timestamp batching', async () => {
  for (const Card of [RunAction, RunWithArgAction, RunCondition, RunWithArgCondition]) {
    const { app, writes } = createScriptApp({ code: 'return args[0] || true;' });
    let run;
    const card = {
      registerRunListener(listener) {
        run = listener;
        return this;
      },
      registerArgumentAutocompleteListener() {
        return this;
      },
    };
    app.homey.app = app;
    app.homey.flow = {
      getActionCard() {
        return card;
      },
      getConditionCard() {
        return card;
      },
    };
    new Card({ homey: app.homey });
    const result = await run({ script: { id: 'example' }, argument: 'Flow' });
    const expectsArgument = Card === RunWithArgAction || Card === RunWithArgCondition;
    assert.equal(result, expectsArgument ? 'Flow' : true);
    assert.ok((await app.getScripts()).example.lastExecuted);
    assert.equal(writes.length, 0);
    await app.updateScript({ id: 'example', lastExecuted: previous });
    app.scripts.example.code = 'throw new Error("Flow failed");';
    await assert.rejects(run({ script: { id: 'example' }, argument: 'Flow' }), /Flow failed/);
    assert.notEqual((await app.getScripts()).example.lastExecuted, previous);
    assert.equal(writes.length, 0);
  }
});

test('script globals receive the previous execution timestamp and inline code creates no metadata', async () => {
  const { app, writes } = createScriptApp({
    code: 'return { previous: __last_executed__.toISOString(), elapsed: __ms_since_last_executed__ };',
  });
  await app.updateScript({ id: 'example', lastExecuted: previous });
  const result = await app.runScript(await app.getScript({ id: 'example' }));
  assert.equal(result.previous, previous);
  assert.ok(result.elapsed >= 0);
  assert.notEqual((await app.getScripts()).example.lastExecuted, previous);

  await app.runScript({ id: 'inline', name: 'Inline', code: 'return 1;', version: 2 });
  assert.equal(app.scriptExecution.getLastExecuted('inline'), null);
  assert.equal(writes.length, 0);
});

test('deleted scripts cannot be resurrected by an in-flight run or orphaned metadata after restart', async () => {
  const { app, settings } = createScriptApp();
  await app.updateScript({ id: 'example', lastExecuted: previous });
  app.scriptExecution.flush();
  let finish;
  app.getHomeyAPI = () => {
    return {
      finish() {
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      destroy() {},
    };
  };
  const running = app.runScript({
    ...app.scripts.example,
    code: 'await Homey.finish(); return 1;',
  });
  await new Promise(setImmediate);
  await app.deleteScript({ id: 'example' });
  finish();
  await running;
  assert.equal(app.scripts.example, undefined);
  assert.equal(app.scriptExecution.getLastExecuted('example'), null);
  await assert.rejects(
    app.updateScript({ id: 'example', lastExecuted: latest }),
    /Script Not Found/,
  );

  const restarted = createScriptApp({ storedSettings: settings });
  assert.deepEqual(Object.keys(await restarted.app.getScripts()), []);
  assert.deepEqual(restarted.settings.scriptExecution, {});
});

test('failed saves retry without discarding newer timestamps and unload flushes pending work', async () => {
  const { app, writes, timers, advanceTime } = createScriptApp();
  const save = app.homey.settings.set;
  app.homey.settings.set = () => {
    throw new Error('Save failed');
  };
  await app.updateScript({ id: 'example', lastExecuted: previous });
  advanceTime(ScriptExecution.SAVE_INTERVAL);
  assert.equal(app.scriptExecution.dirty, true);
  assert.equal(timers.size, 1);
  app.homey.settings.set = save;
  await app.updateScript({ id: 'example', lastExecuted: latest });
  app.homey.emit('unload');
  assert.equal(timers.size, 0);
  assert.equal(writes[0].value.example.lastExecuted, latest);
  assert.equal(app.scriptExecution.dirty, false);
  app.homey.emit('unload');
  assert.equal(writes.length, 1);
});
