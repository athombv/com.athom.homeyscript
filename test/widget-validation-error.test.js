'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WidgetValidationError } = require('../lib/WidgetValidationError');
const { ScriptWidgets } = require('../lib/ScriptWidgets');
const { createScriptApp } = require('./helpers/create-script-app');

async function createSubmission(code) {
  const form = {
    type: 'form',
    id: 'booking',
    onSuccess: 'clear',
    fields: [{ name: 'until', type: 'date', label: 'Until' }],
    submit: { id: 'save', label: 'Save', script: 'Target' },
  };
  const { app } = createScriptApp({
    code: `return new WidgetResult(${JSON.stringify({ blocks: [form] })});`,
  });
  app.scripts.target = { id: 'target', name: 'Target', version: 2, code };
  const snapshot = await app.scriptWidgets.run('example');

  return {
    app,
    request: {
      scriptId: 'example',
      updatedAt: snapshot.updatedAt,
      actionId: 'save',
      formId: 'booking',
      values: { until: '2026-09-01' },
    },
  };
}

test('WidgetValidationError validates and detaches its messages', () => {
  const options = { fields: { until: 'Choose a later date.' }, message: 'Check the dates.' };
  const error = new WidgetValidationError(options);
  options.fields.until = 'Mutated';
  error.fields.until = 'Also mutated';
  const details = WidgetValidationError.getDetails(error);
  details.fields.until = 'Detached copy';
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'WidgetValidationError');
  assert.equal(error.message, 'Check the dates.');
  assert.equal(error.fields.until, 'Choose a later date.');
  assert.equal(WidgetValidationError.getDetails(error).fields.until, 'Choose a later date.');
  assert.equal(WidgetValidationError.getDetails(null), undefined);
  assert.equal(
    WidgetValidationError.getDetails(Object.create(WidgetValidationError.prototype)),
    undefined,
  );

  for (const options of [
    {},
    { fields: {} },
    { fields: { until: '' } },
    { fields: { until: false } },
    { fields: { 'bad name': 'Invalid' } },
    { fields: { until: 'Invalid' }, message: ' ' },
    { fields: { until: 'Invalid' }, message: 'x'.repeat(1025) },
    { fields: { until: 'x'.repeat(1025) } },
    { fields: { until: 'Invalid' }, extra: true },
  ]) {
    assert.throws(() => {
      new WidgetValidationError(options);
    }, /WidgetValidationError/);
  }

  const tooMany = Object.fromEntries(
    Array.from({ length: 33 }, (_, index) => {
      return [`field${index}`, 'Invalid'];
    }),
  );
  assert.throws(() => {
    new WidgetValidationError({ fields: tooMany });
  }, /expected 1–32/);
  const oversized = Object.fromEntries(
    Array.from({ length: 32 }, (_, index) => {
      return [`field${index}`, 'x'.repeat(1024)];
    }),
  );
  assert.throws(() => {
    new WidgetValidationError({ fields: oversized });
  }, /too large/);
});

test('all action endpoints carry thrown VM field errors, optional toast, and failed execution metadata', async () => {
  for (const widget of [
    'script-result',
    'script-result-transparent',
    'script-button',
    'script-button-transparent',
  ]) {
    for (const message of [undefined, 'Check the dates.']) {
      const options = {
        fields: { until: 'Choose a later date.', unrelated: 'Ignore this field.' },
        message,
      };
      const { app, request } = await createSubmission(`
        throw new WidgetValidationError(${JSON.stringify(options)});
        global.set('should-not-run', true);
      `);
      const source = app.scriptWidgets.results.get('example');
      const response = await require(`../widgets/${widget}/api`).runAction({
        homey: { app },
        body: request,
      });
      assert.deepEqual(response, {
        success: false,
        code: 'VALIDATION_ERROR',
        fieldErrors: { until: 'Choose a later date.' },
        error: message,
      });
      assert.equal(app.scriptWidgets.results.get('example'), source);
      assert.equal(app.homey.settings.get('homeyscript-should-not-run'), null);
      assert.ok(app.scriptExecution.getLastExecuted('target'));
      const target = app.scriptWidgets.results.get('target');
      assert.equal(target.success, false);
      assert.equal(target.error, message || 'Please check the form fields.');
      assert.equal(target.validationError.fields.until, 'Choose a later date.');
      response.fieldErrors.until = 'Client mutation';
      assert.equal(target.validationError.fields.until, 'Choose a later date.');
    }
  }
});

test('non-form runs and unknown field names use ordinary error feedback', async () => {
  const { app, request } = await createSubmission(
    `throw new WidgetValidationError({ fields: { missing: 'Invalid' } });`,
  );
  assert.deepEqual(await app.scriptWidgets.runAction(request), {
    success: false,
    error: 'Please check the form fields.',
  });
  await assert.rejects(app.runScript({ ...app.scripts.target }), (err) => {
    assert.equal(err.message, 'Please check the form fields.');
    assert.ok(err.cause instanceof WidgetValidationError);
    return true;
  });
  assert.equal(app.scriptWidgets.results.get('target').success, false);
  app.scripts.example.code = `return new WidgetResult({ blocks: [{ type: 'actions', buttons: [{ id: 'run', label: 'Run', script: 'Target' }] }] });`;
  const source = await app.scriptWidgets.run('example');
  assert.deepEqual(
    await app.scriptWidgets.runAction({
      scriptId: 'example',
      updatedAt: source.updatedAt,
      actionId: 'run',
    }),
    {
      success: false,
      error: 'Please check the form fields.',
    },
  );
});

test('ordinary exceptions cannot masquerade as field errors and returned values remain ignored', async () => {
  const { app, request } = await createSubmission(`
    const error = new Error('Ordinary failure');
    error.name = 'WidgetValidationError';
    error.fields = { until: 'Invalid' };
    throw error;
  `);
  assert.deepEqual(await app.scriptWidgets.runAction(request), {
    success: false,
    error: 'Ordinary failure',
  });
  assert.equal(app.scriptWidgets.results.get('target').validationError, undefined);

  for (const code of [
    'return false;',
    'return new WidgetValidationError({ fields: { until: "Not thrown" } });',
  ]) {
    app.scripts.target.code = code;
    assert.deepEqual(await app.scriptWidgets.runAction(request), { success: true });
    assert.equal(app.scriptWidgets.results.get('target').success, true);
  }
});

test('cached validation errors are detached and oversized details fall back to bounded error text', () => {
  const validationError = { fields: { until: 'Invalid date' } };
  const result = ScriptWidgets.createResult({ success: false, error: 'Invalid', validationError });
  validationError.fields.until = 'Changed';
  assert.equal(result.validationError.fields.until, 'Invalid date');
  const oversized = ScriptWidgets.createResult({
    success: false,
    error: 'x'.repeat(20000),
    validationError,
  });
  assert.equal(oversized.error.length, ScriptWidgets.MAX_RESULT_LENGTH);
  assert.equal(oversized.validationError, undefined);
});
