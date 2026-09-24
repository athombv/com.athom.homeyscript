'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const { ScriptWidgets } = require('../../lib/ScriptWidgets');
const { ScriptExecution } = require('../../lib/ScriptExecution');

// Exercise the real runner with only the Homey host and device API replaced.
const appPath = path.resolve(__dirname, '../../app.js');
const appRequire = createRequire(appPath);
const appModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(appPath, 'utf8'), {
  module: appModule,
  require(id) {
    if (id === 'homey') {
      return { App: class {} };
    }

    return appRequire(id);
  },
  __dirname: path.dirname(appPath),
  Buffer,
  URLSearchParams,
  setTimeout,
});

function createScriptApp({ code = 'return args[0];', storedSettings } = {}) {
  const settings = JSON.parse(
    JSON.stringify(
      storedSettings ?? {
        scripts: { example: { id: 'example', name: 'Example', code, version: 2 } },
      },
    ),
  );
  const writes = [];
  const timers = new Map();
  let timerId = 0;
  let now = 0;
  const homey = new EventEmitter();
  homey.settings = {
    get(key) {
      return structuredClone(settings[key] ?? null);
    },
    set(key, value) {
      const snapshot = JSON.parse(JSON.stringify(value));
      writes.push({ key, value: snapshot });
      settings[key] = snapshot;
    },
  };
  homey.setTimeout = (callback, delay) => {
    timerId += 1;
    timers.set(timerId, { callback, deadline: now + delay });
    return timerId;
  };
  homey.clearTimeout = (id) => {
    timers.delete(id);
  };
  homey.api = { realtime() {} };

  const app = new appModule.exports();
  app.homey = homey;
  app.log = () => {};
  app.error = () => {};
  app.getHomeyAPI = () => {
    return { destroy() {} };
  };
  app.scripts = homey.settings.get('scripts');
  app.scriptExecution = new ScriptExecution(app);
  app.scriptExecution.initialize();
  homey.once('unload', () => {
    app.scriptExecution.stop();
  });
  app.scriptWidgets = new ScriptWidgets(app);

  return {
    app,
    settings,
    writes,
    timers,
    advanceTime(milliseconds) {
      now += milliseconds;

      for (const [id, timer] of timers) {
        if (timer.deadline <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

module.exports = { createScriptApp };
