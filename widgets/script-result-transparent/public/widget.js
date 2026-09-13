'use strict';

window.onHomeyReady = function onHomeyReady(Homey) {
  const settings = Homey.getSettings();
  const scriptId = settings.script?.id;
  const name = document.getElementById('script-name');
  const output = document.getElementById('result');
  const status = document.getElementById('status');
  const showStatus = settings.showStatus !== false;
  const customTitle = settings.title?.trim();
  const content = document.querySelector('main');
  let loading = false;
  let refreshPending = false;
  let hasResult = false;
  const renderer = new window.WidgetResultRenderer({
    output,
    controller: globalThis.WidgetHost.controller(Homey, scriptId, requestRefresh),
  });

  status.hidden = !showStatus;
  name.textContent = customTitle || settings.script?.name || 'Script Result';
  name.hidden = settings.showTitle === false;

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
    output.textContent = 'Select a script in the widget settings.';
    return;
  }

  async function refresh() {
    if (document.hidden) {
      return;
    }

    if (loading) {
      refreshPending = true;
      return;
    }

    loading = true;

    try {
      const response = await Homey.api('GET', `/result?scriptId=${encodeURIComponent(scriptId)}`);
      const { result } = response;

      name.textContent = customTitle || response.name;
      status.classList.remove('error');
      status.hidden = !showStatus;

      if (!result) {
        renderer.clear();
        output.textContent = 'No result yet';
        status.textContent = 'Run this script from a Flow, the editor, or a Script Button.';
        hasResult = false;
        return;
      }

      const timestamp = new Date(result.updatedAt).toLocaleString();

      if (!result.success) {
        output.textContent = 'Script failed';
        renderer.clear();
        status.hidden = false;
        status.textContent = showStatus ? `${result.error} · ${timestamp}` : result.error;
        status.classList.add('error');
        hasResult = false;
        return;
      }

      renderer.render(result);
      hasResult = true;

      status.textContent = `Updated ${timestamp}${result.truncated ? ' · Result shortened' : ''}`;
    } catch (err) {
      status.hidden = false;
      status.textContent = err.message || 'Could not load the result.';
      status.classList.add('error');

      if (!hasResult) {
        renderer.clear();
        output.textContent = 'Result unavailable';
      }
    } finally {
      loading = false;

      // An event can arrive while an older result is still being fetched.
      if (refreshPending) {
        refreshPending = false;
        await refresh();
      }
    }
  }

  function requestRefresh() {
    return refresh().catch(console.error);
  }

  Homey.on('script-result-updated', ({ scriptId: updatedScriptId }) => {
    if (updatedScriptId === scriptId) {
      requestRefresh();
    }
  });

  requestRefresh();
  let timer = setInterval(requestRefresh, 15000);
  document.addEventListener('visibilitychange', requestRefresh);
  window.addEventListener('pageshow', () => {
    clearInterval(timer);
    timer = setInterval(requestRefresh, 15000);
    requestRefresh();
  });
  window.addEventListener('pagehide', () => {
    clearInterval(timer);
  });
};
