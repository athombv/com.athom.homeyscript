'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { WidgetElement, loadWidget } = require('./helpers/widget-dom');

function createWidget(api) {
  const document = new EventTarget();
  const window = new EventTarget();
  const events = new EventEmitter();
  const timers = new Map();
  let timerId = 0;
  const elements = {};

  for (const id of ['script-name', 'result', 'status']) {
    elements[id] = new WidgetElement();
  }

  document.hidden = false;
  document.createElement = (tag) => {
    return new WidgetElement(tag);
  };
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

  loadWidget(
    {
      window,
      document,
      getComputedStyle() {
        return { paddingTop: '16px', paddingBottom: '16px' };
      },
      ResizeObserver: class {
        observe() {}
      },
      setTimeout,
      clearTimeout,
      setInterval(callback) {
        timerId += 1;
        timers.set(timerId, callback);
        return timerId;
      },
      clearInterval(id) {
        timers.delete(id);
      },
    },
    'script-result',
  );
  window.onHomeyReady({
    getSettings() {
      return { script: { id: 'example', name: 'Example' } };
    },
    ready() {},
    on(event, callback) {
      events.on(event, callback);
    },
    api,
  });

  return { document, window, events, timers, elements };
}

function response(value) {
  return {
    name: 'Example',
    result: { success: true, hasValue: true, value, updatedAt: '2026-09-12T12:00:00Z' },
  };
}

test('matching realtime events immediately refresh results without waiting for a timer', async () => {
  let value = 'Before';
  let requests = 0;
  const widget = createWidget(async (method) => {
    assert.equal(method, 'GET');
    requests += 1;
    return response(value);
  });
  await new Promise(setImmediate);
  assert.equal(widget.elements.result.textContent, 'Before');

  value = 'After';
  widget.events.emit('script-result-updated', { scriptId: 'another-script' });
  await new Promise(setImmediate);
  assert.equal(requests, 1);

  widget.events.emit('script-result-updated', { scriptId: 'example' });
  await new Promise(setImmediate);
  assert.equal(requests, 2);
  // Identical millisecond timestamps must not hide a newer result.
  assert.equal(widget.elements.result.textContent, 'After');
});

test('events during an in-flight refresh are coalesced into a subsequent fetch', async () => {
  let release;
  let requests = 0;
  const widget = createWidget(async () => {
    requests += 1;

    if (requests === 1) {
      return await new Promise((resolve) => {
        release = resolve;
      });
    }

    return response('Latest');
  });

  widget.events.emit('script-result-updated', { scriptId: 'example' });
  widget.events.emit('script-result-updated', { scriptId: 'example' });
  assert.equal(requests, 1);
  release(response('Outdated'));
  await new Promise(setImmediate);

  assert.equal(requests, 2);
  assert.equal(widget.elements.result.textContent, 'Latest');
});

test('visibility and polling recover missed events, including after page restoration', async () => {
  let value = 'Initial';
  let requests = 0;
  const widget = createWidget(async () => {
    requests += 1;
    return response(value);
  });
  await new Promise(setImmediate);

  widget.document.hidden = true;
  value = 'While hidden';
  widget.events.emit('script-result-updated', { scriptId: 'example' });
  await new Promise(setImmediate);
  assert.equal(requests, 1);

  widget.document.hidden = false;
  widget.document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(setImmediate);
  assert.equal(widget.elements.result.textContent, 'While hidden');

  widget.window.dispatchEvent(new Event('pagehide'));
  assert.equal(widget.timers.size, 0);
  widget.window.dispatchEvent(new Event('pageshow'));
  await new Promise(setImmediate);
  assert.equal(widget.timers.size, 1);

  value = 'Missed event';
  const poll = [...widget.timers.values()][0];
  await poll();
  assert.equal(widget.elements.result.textContent, 'Missed event');
});

test('a failed fetch can recover on the next realtime event', async () => {
  let fail = true;
  const widget = createWidget(async () => {
    if (fail) {
      throw new Error('Disconnected');
    }

    return response('Recovered');
  });
  await new Promise(setImmediate);
  assert.equal(widget.elements.status.textContent, 'Disconnected');

  fail = false;
  widget.events.emit('script-result-updated', { scriptId: 'example' });
  await new Promise(setImmediate);
  assert.equal(widget.elements.result.textContent, 'Recovered');
});
