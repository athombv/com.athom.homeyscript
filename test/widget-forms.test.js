'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WidgetResult } = require('../lib/WidgetResult');
const { WidgetInteractionController } = require('../lib/WidgetInteractionController');
const { createScriptApp } = require('./helpers/create-script-app');

const form = {
  type: 'form',
  id: 'away',
  fields: [
    { name: 'note', type: 'text', label: 'Note', defaultValue: 'Holiday', required: true },
    { name: 'enabled', type: 'checkbox', label: 'Enabled', defaultValue: false },
    { name: 'until', type: 'date', label: 'Until', defaultValue: null },
  ],
  submit: { id: 'save', label: 'Save', script: 'Target', argument: '  fixed  ' },
};
const values = { note: 'Trip', enabled: false, until: '2028-02-29' };
function snapshot(block = form, timestamp = '2026-09-13T12:00:00Z') {
  return {
    success: true,
    hasValue: true,
    updatedAt: timestamp,
    value: new WidgetResult({ blocks: [block] }).toJSON(),
  };
}
async function panel() {
  const { app } = createScriptApp({
    code: `return new WidgetResult(${JSON.stringify({ blocks: [form] })});`,
  });
  app.scripts.target = {
    id: 'target',
    name: 'Target',
    version: 2,
    code: 'return { event: widgetEvent, args };',
  };
  const result = await app.scriptWidgets.run('example');
  return {
    app,
    request: {
      scriptId: 'example',
      updatedAt: result.updatedAt,
      actionId: 'save',
      formId: 'away',
      values,
    },
  };
}

test('version 2 forms validate defaults and stable identities without changing legacy serialization', () => {
  assert.equal(snapshot().value.$homeyscriptResult, 2);
  assert.equal(WidgetResult.isDocument(snapshot().value), true);
  assert.equal(WidgetResult.isDocument({ ...snapshot().value, $homeyscriptResult: 1 }), false);
  assert.equal(
    new WidgetResult({ blocks: [{ type: 'status', text: 'OK' }] }).toJSON().$homeyscriptResult,
    1,
  );
  assert.equal(
    new WidgetResult({ blocks: [{ type: 'status', id: 'status', text: 'OK' }] }).toJSON()
      .$homeyscriptResult,
    2,
  );
  const invalid = [
    { ...form, id: '' },
    { ...form, fields: [] },
    { ...form, fields: [form.fields[0], form.fields[0]] },
    { ...form, fields: [{ ...form.fields[1], defaultValue: 'false' }] },
    { ...form, fields: [{ ...form.fields[2], defaultValue: '2026-02-29' }] },
  ];
  for (const block of invalid) {
    assert.throws(() => {
      new WidgetResult({ blocks: [block] });
    }, TypeError);
  }
  assert.throws(() => {
    new WidgetResult({ blocks: [form, form] });
  }, /duplicate block id/);
  assert.throws(() => {
    new WidgetResult({ blocks: [form, { type: 'actions', buttons: [form.submit] }] });
  }, /duplicate action id/);
});

test('all widget endpoints pass typed form values and fixed arguments while keeping target returns private', async () => {
  for (const widget of [
    'script-result',
    'script-result-transparent',
    'script-button',
    'script-button-transparent',
  ]) {
    const { app, request } = await panel();
    const source = app.scriptWidgets.results.get('example');
    const response = await require(`../widgets/${widget}/api`).runAction({
      homey: { app },
      body: { ...request, script: 'Injected', argument: 'Injected' },
    });
    assert.deepEqual(response, { success: true });
    assert.deepEqual(app.scriptWidgets.results.get('target').value, {
      event: { type: 'submit', actionId: 'save', formId: 'away', values },
      args: ['  fixed  '],
    });
    assert.equal(app.scriptWidgets.results.get('example'), source);
    assert.ok(app.scriptExecution.getLastExecuted('target'));
    await app.runScript({ ...app.scripts.target });
    assert.equal(app.scriptWidgets.results.get('target').value.event, null);
  }
});

test('server rejects malformed, cross-form and stale submissions before target execution', async () => {
  const { app, request } = await panel();
  for (const changed of [
    { values: { ...values, until: '2026-02-29' } },
    { values: { ...values, note: ' ' } },
    { values: { ...values, enabled: 'false' } },
    { values: { ...values, extra: 'no' } },
    { values: { ...values, note: 'x'.repeat(17000) } },
    { values: {} },
    { formId: 'different' },
    { formId: undefined },
  ]) {
    const response = await app.scriptWidgets.runAction({ ...request, ...changed });
    assert.equal(response.success, false);
    assert.equal(app.scriptWidgets.results.has('target'), false);
  }
  const response = await app.scriptWidgets.runAction({
    ...request,
    values: { ...values, until: 'invalid' },
  });
  assert.equal(response.code, 'VALIDATION_ERROR');
  assert.ok(response.fieldErrors.until);
  app.scriptWidgets.record('example', { success: true, value: snapshot().value });
  assert.equal((await app.scriptWidgets.runAction(request)).code, 'STALE_RESULT');
  assert.equal(app.scriptWidgets.results.has('target'), false);
});

test('controller keeps drafts through refresh, updates untouched defaults, and isolates forms', async () => {
  const requests = [];
  const controller = new WidgetInteractionController({
    dispatch: async (intent) => {
      requests.push(intent);
      return { success: true };
    },
    refresh: async () => {},
  });
  controller.updateResult(snapshot());
  controller.setValue('away', 'note', 'My draft');
  const changed = structuredClone(form);
  changed.fields[0].defaultValue = 'New default';
  changed.fields[1].defaultValue = true;
  const next = snapshot(changed, '2026-09-13T12:01:00Z');
  next.value.blocks.push({ ...form, id: 'other', submit: { ...form.submit, id: 'other-save' } });
  controller.updateResult(next);
  assert.deepEqual(controller.values('away'), { note: 'My draft', enabled: true, until: null });
  await controller.run('save', 'away');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].values, { note: 'My draft', enabled: true, until: null });
  assert.equal(requests[0].formId, 'away');
  assert.equal(controller.values('other').note, 'Holiday');
  assert.equal(controller.values('away').note, 'My draft');
  changed.fields[0] = { name: 'note', type: 'checkbox', label: 'New meaning' };
  controller.updateResult(snapshot(changed));
  assert.equal(controller.values('away').note, false);
  controller.updateResult({ success: true, value: 'Plain' });
  assert.equal(controller.forms.size, 0);
});

test('controller validates locally and never replays a stale submission', async () => {
  let calls = 0;
  const controller = new WidgetInteractionController({
    dispatch: async () => {
      calls += 1;
      return { success: false, code: 'STALE_RESULT', error: 'Panel changed' };
    },
    refresh: async () => {
      controller.updateResult(snapshot(form, '2026-09-13T12:01:00Z'));
    },
  });
  controller.updateResult(snapshot());
  controller.setValue('away', 'note', '');
  assert.equal((await controller.run('save', 'away')).code, 'VALIDATION_ERROR');
  assert.equal(calls, 0);
  controller.setValue('away', 'note', 'Unsaved');
  assert.equal((await controller.run('save', 'away')).code, 'STALE_RESULT');
  assert.equal(calls, 1);
  assert.equal(controller.values('away').note, 'Unsaved');
  assert.equal(controller.result.updatedAt, '2026-09-13T12:01:00Z');
});

test('controller blocks duplicate submissions, retains edits on failure and cleans up subscriptions', async () => {
  let release;
  let calls = 0;
  let notifications = 0;
  const controller = new WidgetInteractionController({
    dispatch: async () => {
      calls += 1;
      return await new Promise((resolve) => {
        release = resolve;
      });
    },
    refresh: async () => {},
  });
  controller.updateResult(snapshot());
  controller.subscribe(() => {
    notifications += 1;
  });
  const pending = controller.run('save', 'away');
  await controller.run('save', 'away');
  assert.equal(calls, 1);
  controller.setValue('away', 'note', 'Edited during execution');
  release({ success: false, error: 'Unavailable' });
  assert.equal((await pending).error, 'Unavailable');
  assert.equal(controller.values('away').note, 'Edited during execution');
  assert.equal(controller.running, false);
  const later = controller.run('save', 'away');
  controller.destroy();
  const count = notifications;
  release({ success: false, error: 'Late failure' });
  assert.equal((await later).ignored, true);
  assert.equal(notifications, count);
});

test('form snapshot is rechecked after target lookup before execution', async () => {
  const { app, request } = await panel();
  const getScript = app.getScript.bind(app);
  app.getScript = async (options) => {
    if (options.id === 'target') {
      app.scriptWidgets.record('example', { success: true, value: snapshot().value });
    }
    return await getScript(options);
  };
  assert.equal((await app.scriptWidgets.runAction(request)).code, 'STALE_RESULT');
  assert.equal(app.scriptWidgets.results.has('target'), false);
});

test('server field errors from an earlier value do not overwrite later edits', async () => {
  let release;
  const controller = new WidgetInteractionController({
    dispatch: async () => {
      return await new Promise((resolve) => {
        release = resolve;
      });
    },
    refresh: async () => {},
  });
  controller.updateResult(snapshot());
  const pending = controller.run('save', 'away');
  controller.setValue('away', 'note', 'Corrected while waiting');
  release({ success: false, code: 'VALIDATION_ERROR', fieldErrors: { note: 'Old value failed' } });
  await pending;
  assert.deepEqual(controller.forms.get('away').errors, {});
});

test('success behavior validates at form and field paths and remains a version 2 document', () => {
  for (const onSuccess of ['retain', 'clear', 'reset']) {
    const block = { ...form, onSuccess, fields: [{ ...form.fields[0], onSuccess }] };
    assert.equal(WidgetResult.isDocument(snapshot(block).value), true);
    assert.equal(snapshot(block).value.$homeyscriptResult, 2);
  }

  assert.throws(() => {
    snapshot({ ...form, onSuccess: 'refresh' });
  }, /blocks\[0\].onSuccess/);
  assert.throws(() => {
    snapshot({ ...form, fields: [{ ...form.fields[0], onSuccess: null }] });
  }, /blocks\[0\].fields\[0\].onSuccess/);
});

test('form success behavior inherits, overrides, and handles every field type', async () => {
  const defaults = { note: 'Holiday', enabled: true, until: '2028-12-31' };

  for (const onSuccess of [undefined, 'retain', 'clear', 'reset']) {
    const block = {
      ...form,
      onSuccess,
      fields: form.fields.map((field) => {
        return { ...field, defaultValue: defaults[field.name] };
      }),
    };
    const controller = new WidgetInteractionController({
      dispatch: async () => {
        return { success: true };
      },
      refresh: async () => {},
    });
    controller.updateResult(snapshot(block));

    for (const [name, value] of Object.entries(values)) {
      controller.setValue('away', name, value);
    }

    await controller.run('save', 'away');
    let expected = values;

    if (onSuccess === 'clear') {
      expected = { note: '', enabled: false, until: null };
    } else if (onSuccess === 'reset') {
      expected = defaults;
    }

    assert.deepEqual(controller.values('away'), expected);
    controller.updateResult(snapshot(block, '2026-09-13T12:01:00Z'));
    assert.deepEqual(controller.values('away'), expected);

    block.onSuccess = 'clear';
    block.fields[0].onSuccess = 'retain';
    block.fields[2].onSuccess = 'reset';
    controller.updateResult(snapshot(block));

    for (const [name, value] of Object.entries(values)) {
      controller.setValue('away', name, value);
    }

    await controller.run('save', 'away');
    assert.deepEqual(controller.values('away'), {
      ...values,
      enabled: false,
      until: defaults.until,
    });
    assert.equal(controller.forms.get('away').fields.get('until').dirty, false);
    controller.destroy();
  }
});

test('success resets omitted defaults to empty values and only affects the submitted form', async () => {
  const block = {
    ...form,
    onSuccess: 'reset',
    fields: form.fields.map(({ defaultValue, ...field }) => {
      return field;
    }),
  };
  const controller = new WidgetInteractionController({
    dispatch: async () => {
      return { success: true };
    },
    refresh: async () => {},
  });
  const document = snapshot(block);
  document.value.blocks.push({
    ...block,
    id: 'other',
    submit: { ...block.submit, id: 'other-save' },
  });
  controller.updateResult(document);
  controller.setValue('away', 'note', 'Submitted');
  controller.setValue('other', 'note', 'Unrelated');
  await controller.run('save', 'away');
  assert.deepEqual(controller.values('away'), { note: '', enabled: false, until: null });
  assert.equal(controller.values('other').note, 'Unrelated');
});

test('success and late field errors preserve edits made away from and back to the submitted value', async () => {
  for (const response of [
    { success: true },
    {
      success: false,
      code: 'VALIDATION_ERROR',
      fieldErrors: { note: 'Old note', until: 'Bad date' },
    },
  ]) {
    let release;
    const controller = new WidgetInteractionController({
      dispatch: async () => {
        return await new Promise((resolve) => {
          release = resolve;
        });
      },
      refresh: async () => {},
    });
    controller.updateResult(snapshot({ ...form, onSuccess: 'clear' }));
    controller.setValue('away', 'until', values.until);
    const pending = controller.run('save', 'away');
    controller.setValue('away', 'note', 'New draft');
    controller.setValue('away', 'note', 'Holiday');
    release(response);
    await pending;
    assert.equal(controller.values('away').note, 'Holiday');
    assert.equal(controller.forms.get('away').errors.note, undefined);

    if (response.success) {
      assert.equal(controller.values('away').until, null);
    } else {
      assert.equal(controller.forms.get('away').errors.until, 'Bad date');
      assert.equal(controller.values('away').until, values.until);
    }
  }
});

test('failed, stale and ignored responses never apply success behavior', async () => {
  for (const outcome of ['failure', 'validation', 'transport', 'stale', 'ignored']) {
    const controller = new WidgetInteractionController({
      dispatch: async () => {
        if (outcome === 'transport') {
          throw new Error('Offline');
        }

        if (outcome === 'validation') {
          return { success: false, code: 'VALIDATION_ERROR', fieldErrors: { note: 'Invalid' } };
        }

        if (outcome === 'stale') {
          return { success: false, code: 'STALE_RESULT' };
        }

        return { success: outcome === 'ignored', ignored: outcome === 'ignored', error: 'Failed' };
      },
      refresh: async () => {
        controller.updateResult(snapshot({ ...form, onSuccess: 'clear' }, '2026-09-13T12:01:00Z'));
      },
    });
    controller.updateResult(snapshot({ ...form, onSuccess: 'clear' }));
    controller.setValue('away', 'note', 'Keep me');
    await controller.run('save', 'away');
    assert.equal(controller.values('away').note, 'Keep me', outcome);
  }
});

test('a changed or recreated form cannot receive an earlier successful reset', async () => {
  for (const recreate of [false, true]) {
    let release;
    const controller = new WidgetInteractionController({
      dispatch: async () => {
        return await new Promise((resolve) => {
          release = resolve;
        });
      },
      refresh: async () => {},
    });
    const block = { ...form, onSuccess: 'clear' };
    controller.updateResult(snapshot(block));
    const pending = controller.run('save', 'away');

    if (recreate) {
      controller.updateResult(null);
    } else {
      block.submit = { ...block.submit, script: 'Another target' };
    }

    controller.updateResult(snapshot(block, '2026-09-13T12:01:00Z'));
    release({ success: true });
    await pending;
    assert.equal(controller.values('away').note, 'Holiday');
  }
});
