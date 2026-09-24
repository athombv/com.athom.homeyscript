'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { WidgetElement } = require('./helpers/widget-dom');

function createRenderer({
  api = async () => {
    return { success: true };
  },
  onStale = async () => {},
} = {}) {
  const window = new EventTarget();
  const document = new EventTarget();
  document.hidden = false;
  document.createElement = (tag) => {
    const element = new WidgetElement(tag);
    element.ownerDocument = document;
    return element;
  };
  document.createTextNode = (text) => {
    const node = new WidgetElement('#text');
    node.textContent = text;
    return node;
  };
  let now = Date.parse('2026-09-12T12:00:00Z');
  const intervals = new Map();
  const timeouts = new Map();
  let timerId = 0;
  const context = vm.createContext({
    window,
    document,
    URL,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    setInterval(callback) {
      const id = ++timerId;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout(callback) {
      const id = ++timerId;
      timeouts.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
  });
  for (const asset of [
    'widget-result.js',
    'widget-markdown.js',
    'widget-controller.js',
    'widget-host.js',
    'result-renderer.js',
  ]) {
    vm.runInContext(
      fs.readFileSync(path.resolve(__dirname, '../widgets/script-result/public', asset), 'utf8'),
      context,
    );
  }
  const output = new WidgetElement();
  const renderer = new window.WidgetResultRenderer({
    output,
    controller: context.WidgetHost.controller({ api }, 'source', onStale),
  });
  return {
    renderer,
    output,
    window,
    document,
    intervals,
    timeouts,
    advance(minutes) {
      now += minutes * 60000;
    },
  };
}

function result(blocks, updatedAt = '2026-09-12T12:00:00Z') {
  return { success: true, hasValue: true, value: { $homeyscriptResult: 1, blocks }, updatedAt };
}

function descendants(element, tag) {
  const found = [];
  for (const child of element.children) {
    if (child.tagName === tag) {
      found.push(child);
    }
    found.push(...descendants(child, tag));
  }
  return found;
}

const actions = [
  {
    type: 'actions',
    buttons: [
      { id: 'go', label: 'Go', script: 'Target' },
      { id: 'other', label: 'Other', script: 'Other' },
    ],
  },
];

test('ordinary returns and unsupported documents print literally, without implicit layouts', () => {
  const { renderer, output } = createRenderer();
  for (const value of [
    'A\tB\nC\tD',
    '<img src=x>',
    0,
    false,
    null,
    ['First', 'Second'],
    { blocks: actions },
    { $homeyscriptResult: 99, blocks: actions },
  ]) {
    renderer.render({ hasValue: true, value });
    assert.equal(
      output.textContent,
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    );
    assert.equal(output.children.length, 0);
  }
});

test('mixed blocks preserve rows, blank cells, headers, list ordering and metric formatting', () => {
  const { renderer, output } = createRenderer();
  renderer.render(
    result([
      {
        type: 'table',
        columns: [
          { key: 'name', label: 'Zone' },
          { key: 'value', label: 'Value', align: 'right' },
        ],
        rows: [
          { name: 'Entrance', value: false },
          { name: 'Variables', value: null },
          { name: '<img>', value: 0 },
        ],
      },
      {
        type: 'list',
        ordered: true,
        items: ['One', { text: 'Two', icon: '🧺', secondary: 'Details' }],
      },
      { type: 'metric', value: 0, decimals: 2, unit: 'W', label: 'Power' },
      {
        type: 'status',
        text: 'Not an execution error',
        description: 'A reported condition',
        tone: 'error',
      },
    ]),
  );
  assert.deepEqual(
    descendants(output, 'td').map((cell) => {
      return cell.textContent;
    }),
    ['Entrance', 'false', 'Variables', '', '<img>', '0'],
  );
  assert.equal(descendants(output, 'th').length, 2);
  assert.equal(descendants(output, 'ol').length, 1);
  assert.ok(output.textContent.includes('0.00 W'));
  assert.equal(descendants(output, 'img').length, 0);
  renderer.render(
    result([
      {
        type: 'table',
        showHeaders: false,
        columns: [{ key: 'name', label: 'Zone' }],
        rows: [{ name: 'Home' }],
      },
    ]),
  );
  assert.equal(descendants(output, 'th').length, 0);
  renderer.render(result([]));
  assert.equal(output.textContent, 'No content');
  renderer.render(
    result([
      { type: 'table', columns: [{ key: 'x', label: '' }], rows: [] },
      { type: 'list', items: [] },
    ]),
  );
  assert.equal(output.textContent, 'No rowsNo items');
});

test('relative timestamps update without requests and timers stop on hidden, replacement and closure', () => {
  let calls = 0;
  const widget = createRenderer({
    api: async () => {
      calls += 1;
    },
  });
  const { renderer, output, intervals, document, window } = widget;
  const snapshot = result([
    {
      type: 'table',
      columns: [{ key: 'time', label: '', format: 'relativeTime' }],
      rows: [{ time: '2026-09-12T11:57:00Z' }, { time: null }],
    },
    {
      type: 'list',
      items: [
        { text: 'Future', secondary: '2026-09-12T12:05:00Z', secondaryFormat: 'relativeTime' },
      ],
    },
  ]);
  renderer.render(snapshot);
  assert.deepEqual(
    descendants(output, 'time').map((time) => {
      return time.textContent;
    }),
    ['3 min ago', 'in 5 min'],
  );
  assert.equal(intervals.size, 1);
  widget.advance(1);
  [...intervals.values()][0]();
  assert.equal(descendants(output, 'time')[0].textContent, '4 min ago');
  renderer.render(structuredClone(snapshot));
  assert.equal(intervals.size, 1);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(intervals.size, 0);
  widget.advance(2);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(descendants(output, 'time')[0].textContent, '6 min ago');
  assert.equal(intervals.size, 1);
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(intervals.size, 0);
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(intervals.size, 1);
  renderer.render({ hasValue: true, value: 'Plain' });
  assert.equal(intervals.size, 0);
  assert.equal(calls, 0);
  assert.equal(snapshot.updatedAt, '2026-09-12T12:00:00Z');
});

test('actions prevent duplicate clicks, retain the panel and ignore target output', async () => {
  const calls = [];
  let release;
  const { renderer, output, timeouts } = createRenderer({
    api: async (...args) => {
      calls.push(args);
      return await new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  const snapshot = result(actions);
  renderer.render(snapshot);
  const controls = descendants(output, 'button');
  controls[0].dispatchEvent(new Event('click'));
  controls[0].dispatchEvent(new Event('click'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'POST');
  assert.equal(calls[0][1], '/action');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), {
    scriptId: 'source',
    actionId: 'go',
    updatedAt: snapshot.updatedAt,
  });
  assert.ok(
    controls.every((button) => {
      return button.attributes['aria-disabled'] === 'true';
    }),
  );
  assert.equal(controls[0].attributes['aria-busy'], undefined);
  assert.equal(controls[0].textContent, 'Go');
  assert.equal(controls[0].disabled, false);
  assert.equal(descendants(output, 'p').length, 0);
  assert.equal(output.children.length, 1);
  renderer.render(structuredClone(snapshot));
  assert.equal(descendants(output, 'button')[0], controls[0]);
  release({ success: true, value: 'Never show this' });
  await new Promise(setImmediate);
  assert.equal(output.textContent.includes('Never show this'), false);
  assert.equal(descendants(output, 'button')[0], controls[0]);
  assert.equal(controls[0].textContent, 'Go');
  assert.equal(descendants(output, 'p').length, 0);
  assert.equal(output.children.length, 1);
  assert.equal(controls[0].className, 'widget-action');
  assert.ok(
    controls.every((button) => {
      return button.attributes['aria-disabled'] === 'false';
    }),
  );
  assert.equal(output.textContent, 'GoOther');
  assert.equal(timeouts.size, 0);
});

test('stale actions fetch a fresh panel without executing it and briefly show an error', async () => {
  let refreshed = 0;
  const widget = createRenderer({
    api: async () => {
      return { success: false, code: 'STALE_RESULT', error: 'Panel changed' };
    },
    onStale: async () => {
      refreshed += 1;
      widget.renderer.render(
        result([{ type: 'status', text: 'Fresh panel' }], '2026-09-12T12:01:00Z'),
      );
    },
  });
  widget.renderer.render(result(actions));
  descendants(widget.output, 'button')[0].dispatchEvent(new Event('click'));
  await new Promise(setImmediate);
  assert.equal(refreshed, 1);
  assert.ok(widget.output.textContent.includes('Fresh panel'));
  assert.ok(widget.output.textContent.includes('Panel changed'));
  assert.equal(widget.timeouts.size, 1);
  [...widget.timeouts.values()][0]();
  assert.equal(widget.output.textContent, 'Fresh panel');
  assert.equal(widget.timeouts.size, 0);
});

test('transport failures restore controls and completing an old action does not overwrite a new result', async () => {
  let release;
  let fail = true;
  const widget = createRenderer({
    api: async () => {
      if (fail) {
        throw new Error('Disconnected');
      }
      return await new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  widget.renderer.render(result(actions));
  descendants(widget.output, 'button')[0].dispatchEvent(new Event('click'));
  await new Promise(setImmediate);
  assert.ok(widget.output.textContent.includes('Disconnected'));
  assert.equal(descendants(widget.output, 'button')[0].disabled, false);
  fail = false;
  descendants(widget.output, 'button')[0].dispatchEvent(new Event('click'));
  assert.equal(widget.output.textContent.includes('Disconnected'), false);
  widget.renderer.render(result([{ type: 'status', text: 'Replacement' }]));
  release({ success: true });
  await new Promise(setImmediate);
  assert.equal(widget.output.textContent, 'Replacement');
  assert.equal(widget.timeouts.size, 0);
});

test('failure toasts announce the error, expire and clean up on replacement or closure', async () => {
  const { renderer, output, window, document, timeouts } = createRenderer({
    api: async () => {
      return { success: false, error: 'Device unavailable' };
    },
  });
  const snapshot = result(actions);
  renderer.render(snapshot);
  const button = descendants(output, 'button')[0];
  button.dispatchEvent(new Event('click'));
  await new Promise(setImmediate);
  const toast = descendants(output, 'p')[0];
  assert.equal(toast.attributes.role, 'alert');
  assert.equal(toast.textContent, 'Device unavailable');
  assert.equal(toast.className, 'widget-error-toast');
  assert.equal(button.textContent, 'Go');
  assert.equal(button.attributes['aria-disabled'], 'false');
  assert.equal(timeouts.size, 1);
  [...timeouts.values()][0]();
  assert.equal(output.textContent, 'GoOther');
  assert.equal(timeouts.size, 0);

  for (const cleanup of [
    () => {
      window.dispatchEvent(new Event('pagehide'));
    },
    () => {
      document.hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    () => {
      renderer.render({ hasValue: true, value: 'Replacement' });
    },
  ]) {
    renderer.showError('Try again');
    assert.equal(timeouts.size, 1);
    cleanup();
    assert.equal(timeouts.size, 0);
    assert.equal(descendants(output, 'p').length, 0);
    document.hidden = false;
    window.dispatchEvent(new Event('pageshow'));
  }
});

test('Markdown renders semantic text alongside other blocks and preserves references and code', () => {
  const { renderer, output } = createRenderer();
  renderer.render(
    result([
      { type: 'status', text: 'Before' },
      {
        type: 'markdown',
        text: '# Home\n\n**Ready** and *quiet*, `a < b` &amp; safe.\n\n> A note\n\n3. First\n4. Second\n\n- Parent\n  - Child\n\n[Help][homey]\n\n[homey]: https://homey.app "Homey"\n[homey]: https://example.com\n\n```js\n<img onerror=alert(1)>\n```\n\n---',
      },
      { type: 'metric', value: 42 },
    ]),
  );
  assert.equal(output.children.length, 3);
  assert.equal(descendants(output, 'h1')[0].textContent, 'Home');
  assert.equal(descendants(output, 'strong')[0].textContent, 'Ready');
  assert.equal(descendants(output, 'em')[0].textContent, 'quiet');
  assert.equal(descendants(output, 'blockquote')[0].textContent, 'A note');
  assert.equal(descendants(output, 'ol')[0].attributes.start, '3');
  assert.equal(descendants(output, 'ul').length, 2);
  assert.equal(descendants(output, 'a')[0].attributes.href, 'https://homey.app/');
  assert.equal(descendants(output, 'a')[0].attributes.rel, 'noopener noreferrer');
  assert.equal(descendants(output, 'pre')[0].textContent, '<img onerror=alert(1)>');
  assert.equal(descendants(output, 'hr').length, 1);
  assert.ok(output.textContent.includes('& safe.'));
});

test('Markdown never renders HTML, images or unsafe links as active content', () => {
  const { renderer, output } = createRenderer();
  renderer.render(
    result([
      {
        type: 'markdown',
        text: [
          '<script>alert(1)</script>',
          '<iframe src="https://example.com"></iframe>',
          '<img src=x onerror=alert(1)>',
          '![Camera](https://example.com/camera.jpg)',
          '[JS](javascript:alert%281%29) [encoded](jav&#x61;script:alert%281%29)',
          '[data](data:text/html,test) [local](/api/action) [file](file:///etc/passwd)',
          '[protocol relative](//example.com) [mail](mailto:home@example.com)',
          '[ref][unsafe]\n\n[unsafe]: javascript:alert%281%29',
        ].join('\n\n'),
      },
    ]),
  );
  for (const tag of ['script', 'iframe', 'img', 'style']) {
    assert.equal(descendants(output, tag).length, 0);
  }
  const links = descendants(output, 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].attributes.href, 'mailto:home@example.com');
  assert.ok(output.textContent.includes('Camera'));
  assert.ok(output.textContent.includes('encoded'));
  renderer.render(result([{ type: 'markdown', text: '' }]));
  assert.equal(output.textContent, '');
  renderer.render({ hasValue: true, value: '**plain return**' });
  assert.equal(descendants(output, 'strong').length, 0);
  assert.equal(output.textContent, '**plain return**');
});

test('forms retain live input nodes and drafts across result updates and dispose their subscriptions', () => {
  const { renderer, output } = createRenderer();
  const form = {
    type: 'form',
    id: 'settings',
    fields: [
      { name: 'note', type: 'text', label: 'Note', defaultValue: 'Initial' },
      { name: 'enabled', type: 'checkbox', label: 'Enabled', defaultValue: false },
    ],
    submit: { id: 'save', label: 'Save', script: 'save' },
  };
  const snapshot = result([form]);
  snapshot.value.$homeyscriptResult = 2;
  renderer.render(snapshot);
  const [input, checkbox] = descendants(output, 'input');
  input.value = 'Draft';
  input.dispatchEvent(new Event('input'));
  const next = structuredClone(snapshot);
  next.updatedAt = '2026-09-12T12:01:00Z';
  next.value.blocks.unshift({ type: 'status', text: 'Updated' });
  next.value.blocks[1].fields[0].defaultValue = 'Remote';
  next.value.blocks[1].fields[1].defaultValue = true;
  renderer.render(next);
  assert.equal(descendants(output, 'input')[0], input);
  assert.equal(input.value, 'Draft');
  assert.equal(checkbox.checked, true);
  assert.equal(renderer.controller.listeners.size, 1);
  renderer.destroy();
  assert.equal(renderer.controller.listeners.size, 0);
  assert.equal(output.textContent, '');
});

test('script field errors focus the input, optionally toast, and clear on edit before successful clearing', async () => {
  for (const message of [undefined, 'Please review these settings.']) {
    let response = {
      success: false,
      code: 'VALIDATION_ERROR',
      fieldErrors: { note: '<b>Choose another note.</b>' },
      error: message,
    };
    const { renderer, output, document, timeouts } = createRenderer({
      api: async () => {
        return response;
      },
    });
    const snapshot = result([
      {
        type: 'form',
        id: 'settings',
        onSuccess: 'clear',
        fields: [{ name: 'note', type: 'text', label: 'Note', defaultValue: 'Original' }],
        submit: { id: 'save', label: 'Save', script: 'save' },
      },
    ]);
    snapshot.value.$homeyscriptResult = 2;
    renderer.render(snapshot);
    const [input] = descendants(output, 'input');
    await renderer.runAction('save', 'settings');
    assert.equal(input.value, 'Original');
    assert.equal(document.activeElement, input);
    assert.equal(input.attributes['aria-invalid'], 'true');
    assert.ok(output.textContent.includes('<b>Choose another note.</b>'));
    assert.equal(descendants(output, 'b').length, 0);
    assert.equal(timeouts.size, message ? 1 : 0);

    if (message) {
      assert.equal(renderer.feedback.textContent, message);
    }

    input.value = 'Corrected';
    input.dispatchEvent(new Event('input'));
    assert.equal(input.attributes['aria-invalid'], 'false');
    response = { success: true };
    await renderer.runAction('save', 'settings');
    assert.equal(input.value, '');
    assert.equal(descendants(output, 'input')[0], input);
    assert.equal(document.activeElement, input);
    assert.equal(timeouts.size, 0);
    renderer.destroy();
  }
});
