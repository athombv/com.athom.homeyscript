'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WidgetElement, loadWidget } = require('./helpers/widget-dom');

function createWidget(widgetId, settings, api, { reducedMotion = true } = {}) {
  const elements = {};
  const document = new EventTarget();
  document.body = {};
  document.activeElement = null;
  const motion = new EventTarget();
  motion.matches = reducedMotion;
  const timers = new Map();
  let timerId = 0;

  for (const id of ['script-name', 'run-form', 'run', 'argument', 'label', 'status', 'result']) {
    const element = new WidgetElement();
    element.value = '';
    element.disabled = false;
    element.classList = { add() {}, toggle() {} };
    element.setAttribute = () => {};
    element.removeAttribute = () => {};
    element.focus = () => {
      document.activeElement = element;
    };
    elements[id] = element;
  }

  document.getElementById = (id) => {
    return elements[id];
  };
  document.querySelector = () => {
    return {
      getBoundingClientRect() {
        return { height: 100 };
      },
    };
  };
  const window = new EventTarget();
  document.createElement = (tag) => {
    return new WidgetElement(tag);
  };
  loadWidget(
    {
      window,
      document,
      console,
      matchMedia() {
        return motion;
      },
      setInterval,
      clearInterval,
      setTimeout(callback) {
        timerId += 1;
        timers.set(timerId, callback);
        return timerId;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      getComputedStyle() {
        return { paddingTop: '16px', paddingBottom: '16px' };
      },
      ResizeObserver: class {
        observe() {}
      },
    },
    widgetId,
  );
  window.onHomeyReady({
    getSettings() {
      return { script: { id: 'example', name: 'Example' }, ...settings };
    },
    ready() {},
    api,
  });

  return {
    elements,
    document,
    motion,
    timers,
    submit() {
      const event = new Event('submit', { cancelable: true });
      elements['run-form'].dispatchEvent(event);
      assert.equal(event.defaultPrevented, true, 'submission must not navigate');
    },
  };
}

for (const widgetId of ['script-button', 'script-button-transparent']) {
  test(`${widgetId}: fast runs show results immediately and finish the spinner rotation before unlocking`, async () => {
    let requests = 0;
    const widget = createWidget(
      widgetId,
      {},
      async () => {
        requests += 1;
        return { success: true, hasValue: true, value: 'Done' };
      },
      { reducedMotion: false },
    );
    widget.submit();
    await new Promise(setImmediate);
    assert.equal(widget.elements.result.textContent, 'Done');
    assert.equal(widget.elements.status.textContent, 'Running script…');
    assert.equal(widget.elements.run.disabled, true);
    // A cancellation queued by the previous run must not end this animation.
    widget.elements.run.dispatchEvent(new Event('animationcancel'));
    await new Promise(setImmediate);
    assert.equal(widget.elements.run.disabled, true);
    widget.submit();
    assert.equal(requests, 1);

    const unrelated = new Event('animationiteration');
    Object.assign(unrelated, { animationName: 'other', pseudoElement: '::before' });
    widget.elements.run.dispatchEvent(unrelated);
    await new Promise(setImmediate);
    assert.equal(widget.elements.run.disabled, true);

    const rotation = new Event('animationiteration');
    Object.assign(rotation, { animationName: 'spin', pseudoElement: '::before' });
    widget.elements.run.dispatchEvent(rotation);
    await new Promise(setImmediate);
    assert.equal(widget.elements.run.disabled, false);
    assert.equal(widget.elements.status.textContent, 'Script finished successfully');
    assert.equal(widget.timers.size, 0);
  });

  test(`${widgetId}: failed runs also finish their rotation, with recovery for interrupted animations`, async () => {
    for (const interruption of ['rotation', 'hidden', 'reduced-motion', 'timeout']) {
      const widget = createWidget(
        widgetId,
        {},
        async () => {
          throw new Error('Script failed');
        },
        { reducedMotion: false },
      );
      widget.submit();
      await new Promise(setImmediate);
      assert.equal(widget.elements.status.textContent, 'Running script…');
      assert.equal(widget.elements.run.disabled, true);

      if (interruption === 'rotation') {
        const event = new Event('animationiteration');
        Object.assign(event, { animationName: 'spin', pseudoElement: '::before' });
        widget.elements.run.dispatchEvent(event);
      } else if (interruption === 'hidden') {
        widget.document.hidden = true;
        widget.document.dispatchEvent(new Event('visibilitychange'));
      } else if (interruption === 'reduced-motion') {
        widget.motion.matches = true;
        widget.motion.dispatchEvent(new Event('change'));
      } else {
        const timeout = [...widget.timers.values()][0];
        timeout();
      }

      await new Promise(setImmediate);
      assert.equal(widget.elements.run.disabled, false);
      assert.equal(widget.elements.status.textContent, 'Script failed');
      assert.equal(widget.timers.size, 0);
    }
  });

  test(`${widgetId}: submits exact input once, disables controls, and retains text by default`, async () => {
    const calls = [];
    let release;
    const widget = createWidget(widgetId, { enableArgument: true }, async (method, route, body) => {
      calls.push({ method, route, ...body });
      return await new Promise((resolve) => {
        release = resolve;
      });
    });
    assert.equal(calls.length, 0);
    widget.elements.argument.value = '  hello 世界  ';
    widget.document.activeElement = widget.elements.argument;
    widget.submit();
    widget.submit();
    assert.deepEqual(calls, [
      { method: 'POST', route: '/run', scriptId: 'example', argument: '  hello 世界  ' },
    ]);
    assert.equal(widget.elements.run.disabled, true);
    assert.equal(widget.elements.argument.disabled, true);

    widget.document.activeElement = widget.document.body;
    release({ success: true, hasValue: true, value: 'Done' });
    await new Promise(setImmediate);
    assert.equal(widget.elements.run.disabled, false);
    assert.equal(widget.elements.argument.disabled, false);
    assert.equal(widget.elements.argument.value, '  hello 世界  ');
    assert.equal(widget.document.activeElement, widget.elements.argument);
    assert.equal(widget.elements.result.textContent, 'Done');
  });

  test(`${widgetId}: keeps previous output visible until the next run settles`, async () => {
    for (const outcome of [
      { success: true, hasValue: true, value: 'New result' },
      { success: true, hasValue: false },
      { success: false, error: 'Script failed' },
      new Error('Disconnected'),
    ]) {
      let release;
      let requests = 0;
      const widget = createWidget(widgetId, {}, async () => {
        requests += 1;

        if (requests === 1) {
          return { success: true, hasValue: true, value: 'Previous result' };
        }

        return await new Promise((resolve, reject) => {
          release = () => {
            if (outcome instanceof Error) {
              reject(outcome);
              return;
            }

            resolve(outcome);
          };
        });
      });
      widget.submit();
      await new Promise(setImmediate);
      widget.submit();
      await new Promise(setImmediate);
      assert.equal(widget.elements.result.hidden, false);
      assert.equal(widget.elements.result.textContent, 'Previous result');

      release();
      await new Promise(setImmediate);
      assert.equal(widget.elements.result.hidden, outcome.hasValue !== true);

      if (outcome.hasValue) {
        assert.equal(widget.elements.result.textContent, 'New result');
      }
    }
  });

  test(`${widgetId}: clears only on success and recovers from script and transport errors`, async () => {
    let outcome = new Error('Disconnected');
    const widget = createWidget(
      widgetId,
      { enableArgument: true, clearAfterRun: true, showStatus: false },
      async () => {
        if (outcome instanceof Error) {
          throw outcome;
        }

        return outcome;
      },
    );
    widget.elements.argument.value = 'Keep this';

    for (const failure of [outcome, { success: false, error: 'Script failed' }]) {
      outcome = failure;
      widget.submit();
      await new Promise(setImmediate);
      assert.equal(widget.elements.argument.value, 'Keep this');
      assert.equal(widget.elements.status.hidden, false);
      assert.equal(widget.elements.run.disabled, false);
    }

    outcome = { success: true, hasValue: false };
    widget.submit();
    await new Promise(setImmediate);
    assert.equal(widget.elements.argument.value, '');
    assert.equal(widget.elements.status.hidden, true);
  });

  test(`${widgetId}: disabled argument mode ignores old configured and hidden input values`, async () => {
    let argument;
    const widget = createWidget(
      widgetId,
      { argument: 'Old setting' },
      async (method, route, body) => {
        argument = body.argument;
        return { success: true, hasValue: false };
      },
    );
    widget.elements.argument.value = 'Hidden value';
    widget.submit();
    await new Promise(setImmediate);
    assert.equal(argument, '');
    assert.equal(widget.elements.argument.hidden, true);
    assert.equal(widget.elements.argument.disabled, true);
    assert.equal(widget.elements.label.hidden, false);
  });

  test(`${widgetId}: IME Enter is suppressed and ordinary submission resumes after composition`, async () => {
    let calls = 0;
    const widget = createWidget(widgetId, { enableArgument: true }, async () => {
      calls += 1;
      return { success: true, hasValue: false };
    });
    widget.elements.argument.dispatchEvent(new Event('compositionstart'));
    widget.submit();
    assert.equal(calls, 0);
    widget.elements.argument.dispatchEvent(new Event('compositionend'));

    for (const properties of [{ isComposing: true }, { keyCode: 229 }, {}]) {
      const event = new Event('keydown', { cancelable: true });
      Object.assign(event, { key: 'Enter', ...properties });
      widget.elements.argument.dispatchEvent(event);
      assert.equal(event.defaultPrevented, Object.keys(properties).length > 0);
    }

    widget.submit();
    await new Promise(setImmediate);
    assert.equal(calls, 1);
  });
}
