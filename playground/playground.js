'use strict';

const editor = document.querySelector('#json');
const diagnostic = document.querySelector('#diagnostic');
const frames = [...document.querySelectorAll('iframe')];
const exampleSelect = document.querySelector('#example');
const mode = document.querySelector('#mode');
const variant = document.querySelector('#variant');
const examples = globalThis.PlaygroundExamples.create();
const events = [];
let revision = Date.now();
let result;

for (const example of examples) {
  const option = document.createElement('option');
  option.value = example.id;
  option.textContent = example.label;
  exampleSelect.append(option);
}

function message(type, frame) {
  const dark = document.querySelector('#theme').value === 'dark';
  const transparent = variant.value.endsWith('-transparent');
  const data = {
    type,
    result,
    outcome: document.querySelector('#outcome').value,
    dark,
    fontScale: Number(document.querySelector('#font-scale').value),
    enableArgument: document.querySelector('#enable-argument').checked,
  };
  document.documentElement.classList.toggle('homey-dark-mode', dark);
  document.body.classList.toggle('transparent-preview', transparent);

  for (const target of frame ? [frame] : frames) {
    target.contentWindow.postMessage(data, location.origin);
  }
}

function apply(type = 'render') {
  try {
    const input = JSON.parse(editor.value);
    const updatedAt = new Date(++revision).toISOString();

    if (mode.value === 'document') {
      result = {
        success: true,
        hasValue: true,
        value: new globalThis.WidgetResult(input).toJSON(),
        updatedAt,
      };
    } else if (mode.value === 'value') {
      result = { success: true, hasValue: true, value: input, updatedAt };
    } else {
      if (
        input !== null &&
        (typeof input !== 'object' || Array.isArray(input) || typeof input.success !== 'boolean')
      ) {
        throw new Error('A result state needs a success boolean, or null for no cached result.');
      }

      result = input === null ? null : { ...input, updatedAt };
    }

    diagnostic.textContent = '';
    const blocks = globalThis.WidgetResult.isDocument(result?.value) ? result.value.blocks : [];
    document.querySelector('#update').disabled = !blocks.some((block) => {
      return block.type === 'form';
    });
    document.querySelector('#reorder').disabled = mode.value !== 'document';
    message(type);
  } catch (err) {
    diagnostic.textContent = `${err.message} The previews still show the last valid result.`;
  }
}

function loadExample() {
  const example = globalThis.PlaygroundExamples.create().find((entry) => {
    return entry.id === exampleSelect.value;
  });
  mode.value = example.mode;
  editor.value = JSON.stringify(example.value, null, 2);
  apply();
}

function loadFrames() {
  for (const frame of frames) {
    frame.src = `/preview/${variant.value}/index.html`;
  }
}

for (const frame of frames) {
  frame.addEventListener('load', () => {
    message('render', frame);
  });
}

exampleSelect.addEventListener('change', loadExample);
variant.addEventListener('change', loadFrames);
document.querySelector('#enable-argument').addEventListener('change', loadFrames);
document.querySelector('#apply').addEventListener('click', () => {
  apply();
});
document.querySelector('#stale').addEventListener('click', () => {
  apply('stage');
});
document.querySelector('#update').addEventListener('click', () => {
  const next = structuredClone(result.value);

  for (const block of next.blocks) {
    if (block.type !== 'form') {
      continue;
    }

    for (const field of block.fields) {
      if (field.type === 'text') {
        field.defaultValue = `Remote update ${revision}`;
      }

      if (field.type === 'checkbox') {
        field.defaultValue = !field.defaultValue;
      }
    }
  }

  mode.value = 'document';
  editor.value = JSON.stringify({ blocks: next.blocks }, null, 2);
  apply();
});
document.querySelector('#reorder').addEventListener('click', () => {
  editor.value = JSON.stringify({ blocks: [...result.value.blocks].reverse() }, null, 2);
  apply();
});

for (const id of ['outcome', 'theme', 'font-scale']) {
  document.getElementById(id).addEventListener('change', () => {
    message('configure');
  });
}

window.addEventListener('message', (event) => {
  const source = frames.find((frame) => {
    return frame.contentWindow === event.source;
  });

  if (event.origin !== location.origin || !source) {
    return;
  }

  if (event.data?.type === 'height') {
    source.style.height = `${Math.max(120, Math.min(640, event.data.height))}px`;
    return;
  }

  if (event.data?.type !== 'interaction') {
    return;
  }

  events.unshift(event.data.event);
  events.length = Math.min(events.length, 10);
  document.querySelector('#events').textContent = JSON.stringify(events, null, 2);
});
loadExample();
loadFrames();
