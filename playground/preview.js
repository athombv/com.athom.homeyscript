'use strict';

let remote;
let outcome = 'success';
let started = false;
let renderRevision = 0;
const listeners = new Map();
const settings = {
  script: { id: 'preview', name: 'Playground script' },
  showTitle: true,
  showStatus: true,
  showResult: true,
  label: 'Run preview',
};

function sendHeight({ height }) {
  parent.postMessage({ type: 'height', height }, location.origin);
}

async function dispatchAction(intent) {
  if (intent.updatedAt !== remote?.updatedAt) {
    return {
      success: false,
      code: 'STALE_RESULT',
      error: 'The panel changed. Review it and try again.',
    };
  }

  const document = remote.value;

  if (!globalThis.WidgetResult.isDocument(document)) {
    return { success: false, error: 'This result has no actions.' };
  }

  let form;
  let action;

  for (const block of document.blocks) {
    if (
      block.type === 'form' &&
      block.id === intent.formId &&
      block.submit.id === intent.actionId
    ) {
      form = block;
      action = block.submit;
      break;
    }

    if (block.type === 'actions' && intent.formId === undefined) {
      action = block.buttons.find((button) => {
        return button.id === intent.actionId;
      });

      if (action) {
        break;
      }
    }
  }

  if (!action) {
    return { success: false, error: 'Action not found in this preview.' };
  }

  if (form) {
    const fieldErrors = globalThis.WidgetResult.validateValues(form, intent.values);

    if (Object.keys(fieldErrors).length > 0) {
      return { success: false, code: 'VALIDATION_ERROR', fieldErrors };
    }
  }

  const event = { type: 'action', actionId: intent.actionId };

  if (form) {
    Object.assign(event, { type: 'submit', formId: form.id, values: intent.values });
  }

  parent.postMessage(
    {
      type: 'interaction',
      event: { script: action.script, argument: action.argument, widgetEvent: event },
    },
    location.origin,
  );
  const selectedOutcome = outcome;
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });

  if (selectedOutcome === 'transport') {
    throw new Error('Simulated connection failure.');
  }

  if (selectedOutcome === 'failure') {
    return { success: false, error: 'Simulated execution failure. Your draft is retained.' };
  }

  if (['fields', 'fields-message'].includes(selectedOutcome) && form) {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      fieldErrors: { [form.fields[0].name]: 'Simulated field error. Please revise this value.' },
      error:
        selectedOutcome === 'fields-message' ? 'Some settings need your attention.' : undefined,
    };
  }

  return { success: true };
}

const homey = {
  getSettings() {
    return settings;
  },
  ready: sendHeight,
  setHeight: async (height) => {
    sendHeight({ height });
  },
  on(name, listener) {
    listeners.set(name, listener);
  },
  api: async (method, path, body) => {
    if (method === 'GET') {
      return { name: settings.script.name, result: remote };
    }

    if (path === '/action') {
      return await dispatchAction(body);
    }

    return remote || { success: true, hasValue: false };
  },
};

async function renderButtonPreview() {
  const revision = ++renderRevision;
  const button = document.querySelector('#run');

  while (button.disabled) {
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  if (revision !== renderRevision) {
    return;
  }

  // Show the latest example even when it changed during a simulated run.
  button.click();
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== parent) {
    return;
  }

  if (!['render', 'stage', 'configure'].includes(event.data?.type)) {
    return;
  }

  const data = event.data;
  outcome = data.outcome;
  document.documentElement.classList.toggle('homey-dark-mode', data.dark);
  document.documentElement.dataset.transparent = String(
    location.pathname.includes('-transparent/'),
  );
  document.documentElement.style.setProperty('--homey-font-scale', data.fontScale);

  if (data.type === 'configure') {
    return;
  }

  remote = data.result;

  if (data.type === 'stage') {
    return;
  }

  if (!started) {
    settings.enableArgument = data.enableArgument;
    started = true;
    window.onHomeyReady(homey);
  }

  const button = document.querySelector('#run');

  if (button) {
    // Apply JSON is a simulated script run, exercising the actual Script Button host.
    renderButtonPreview().catch(console.error);
  } else {
    listeners.get('script-result-updated')?.({ scriptId: 'preview' });
  }
});
