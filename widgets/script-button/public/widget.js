'use strict';

window.onHomeyReady = function onHomeyReady(Homey) {
  const settings = Homey.getSettings();
  const scriptId = settings.script?.id;
  const name = document.getElementById('script-name');
  const button = document.getElementById('run');
  const form = document.getElementById('run-form');
  const input = document.getElementById('argument');
  const label = document.getElementById('label');
  const status = document.getElementById('status');
  const output = document.getElementById('result');
  const showStatus = settings.showStatus !== false;
  const showResult = settings.showResult !== false;
  const buttonLabel = settings.label || 'Run script';
  const enableArgument = settings.enableArgument === true;
  const clearAfterRun = settings.clearAfterRun === true;
  const content = document.querySelector('main');
  let composing = false;

  status.hidden = !showStatus;
  input.hidden = !enableArgument;
  label.hidden = enableArgument || settings.showLabel === false;
  button.setAttribute('aria-label', buttonLabel);
  button.title = buttonLabel;
  name.textContent = settings.title?.trim() || settings.script?.name || 'Script Button';
  name.hidden = settings.showTitle === false;
  label.textContent = buttonLabel;

  function measureHeight() {
    const style = getComputedStyle(document.body);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    // Measure content, not the iframe's current height, so it can shrink too.
    return Math.ceil(content.getBoundingClientRect().height + padding);
  }

  let currentHeight = measureHeight();
  Homey.ready({ height: currentHeight });

  const resizeObserver = new ResizeObserver(() => {
    const height = measureHeight();

    if (height === currentHeight) {
      return;
    }

    currentHeight = height;
    Homey.setHeight(height).catch(console.error);
  });
  resizeObserver.observe(content);

  if (!scriptId) {
    status.hidden = false;
    status.textContent = 'Select a script in the widget settings.';
    return;
  }

  status.textContent = 'Ready to run';
  button.disabled = false;
  input.disabled = !enableArgument;

  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
  });
  input.addEventListener('keydown', (event) => {
    // Some WebViews report the composition-ending Enter only through keyCode.
    if (event.key === 'Enter' && (composing || event.isComposing || event.keyCode === 229)) {
      event.preventDefault();
    }
  });

  async function run(event) {
    event.preventDefault();

    if (button.disabled || composing) {
      return;
    }

    const restoreInputFocus = document.activeElement === input;
    const argument = enableArgument ? input.value : '';
    button.disabled = true;
    input.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', 'Running script');
    status.className = 'homey-text-small-light';
    status.hidden = !showStatus;
    status.textContent = 'Running script…';

    let completionText = 'Script finished successfully';
    let completionClass = 'success';
    let completionVisible = showStatus;

    // Keep the previous output in place until this run settles to avoid height flicker.
    try {
      const result = await Homey.api('POST', '/run', {
        scriptId,
        argument,
      });

      output.hidden = true;

      if (!result.success) {
        completionVisible = true;
        completionText = result.error;
        completionClass = 'error';
        return;
      }

      if (enableArgument && clearAfterRun) {
        input.value = '';
      }

      if (showResult && result.displayError) {
        completionVisible = true;
        completionText = result.displayError;
      }

      if (showResult && result.hasValue) {
        output.textContent =
          typeof result.value === 'string' ? result.value : JSON.stringify(result.value, null, 2);
        output.hidden = false;
      }
    } catch (err) {
      output.hidden = true;
      completionVisible = true;
      completionText = err.message || 'Could not run the script.';
      completionClass = 'error';
    } finally {
      await finishSpinnerRotation();

      status.hidden = !completionVisible;
      status.textContent = completionText;
      status.classList.add(completionClass);
      button.disabled = false;
      input.disabled = !enableArgument;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-label', buttonLabel);

      if (restoreInputFocus && document.activeElement === document.body) {
        input.focus({ preventScroll: true });
      }
    }
  }

  async function finishSpinnerRotation() {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    if (reducedMotion.matches || document.hidden) {
      return;
    }

    await new Promise((resolve) => {
      function finish() {
        clearTimeout(timeout);
        button.removeEventListener('animationiteration', onIteration);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        reducedMotion.removeEventListener('change', onMotionChange);
        resolve();
      }

      function onIteration(event) {
        if (event.animationName === 'spin' && event.pseudoElement === '::before') {
          finish();
        }
      }

      function onVisibilityChange() {
        if (document.hidden) {
          finish();
        }
      }

      function onMotionChange() {
        if (reducedMotion.matches) {
          finish();
        }
      }

      // A rotation takes 400ms. Recover if a WebView drops the animation event.
      const timeout = setTimeout(finish, 600);
      button.addEventListener('animationiteration', onIteration);
      document.addEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.addEventListener('change', onMotionChange);
    });
  }

  form.addEventListener('submit', (event) => {
    run(event).catch(console.error);
  });
};
