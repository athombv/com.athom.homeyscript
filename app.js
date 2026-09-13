'use strict';

const fs = require('fs').promises;
const vm = require('vm');
const util = require('util');
const path = require('path');
const http = require('http');
const https = require('https');
const uuid = require('uuid');

const Homey = require('homey');
const { HomeyAPI: HomeyAPILegacy } = require('athom-api');
const { HomeyAPIV2, HomeyAPIV3Local } = require('homey-api');
const fetch = require('node-fetch');
const _ = require('lodash');
const { ScriptWidgets } = require('./lib/ScriptWidgets');
const { WidgetResult } = require('./lib/WidgetResult');
const { WidgetValidationError } = require('./lib/WidgetValidationError');
const { ScriptExecution } = require('./lib/ScriptExecution');

const { RunCondition } = require('./lib/flow/conditions/RunCondition');
const { RunWithArgCondition } = require('./lib/flow/conditions/RunWithArgCondition');
const { RunCodeCondition } = require('./lib/flow/conditions/RunCodeCondition');
const { RunCodeWithArgCondition } = require('./lib/flow/conditions/RunCodeWithArgCondition');

const { RunAction } = require('./lib/flow/actions/RunAction');
const { RunCodeAction } = require('./lib/flow/actions/RunCodeAction');
const { RunWithArgAction } = require('./lib/flow/actions/RunWithArgAction');
const { RunCodeReturnsStringAction } = require('./lib/flow/actions/RunCodeReturnsStringAction');
const { RunCodeReturnsNumberAction } = require('./lib/flow/actions/RunCodeReturnsNumberAction');
const { RunCodeReturnsBooleanAction } = require('./lib/flow/actions/RunCodeReturnsBooleanAction');
const { RunCodeWithArgAction } = require('./lib/flow/actions/RunCodeWithArgAction');
const {
  RunCodeWithArgReturnsStringAction,
} = require('./lib/flow/actions/RunCodeWithArgReturnsStringAction');
const {
  RunCodeWithArgReturnsNumberAction,
} = require('./lib/flow/actions/RunCodeWithArgReturnsNumberAction');
const {
  RunCodeWithArgReturnsBooleanAction,
} = require('./lib/flow/actions/RunCodeWithArgReturnsBooleanAction');

module.exports = class HomeyScriptApp extends Homey.App {
  static RUN_TIMEOUT = 1000 * 30; // 30s

  async onInit() {
    // Remove since alot of them will be caused by user errors.
    process.removeAllListeners('unhandledRejection');

    process.on('unhandledRejection', (reason, promise) => {
      this.error('Unhandled Rejection:', reason);
    });

    // Init Scripts
    this.scripts = this.homey.settings.get('scripts');

    this.localUrl = await this.homey.api.getLocalUrl();
    this.sessionToken = await this.homey.api.getOwnerApiToken();

    this.apiProps = await (async () => {
      const props = {
        token: this.sessionToken,
        baseUrl: this.localUrl,
        strategy: [],
        properties: {
          id: await this.homey.cloud.getHomeyId(),
          softwareVersion: this.homey.version,
        },
      };

      return props;
    })();

    const exampleFolder = this.homey.platformVersion >= 2 ? 'examples' : 'examples-v1';

    if (!this.scripts) {
      this.log('No scripts found.');

      const scripts = {};

      // Copy example scripts
      try {
        const files = await fs.readdir(path.join(__dirname, exampleFolder));
        await Promise.all(
          files.map(async (filename) => {
            if (!filename.endsWith('.js')) return;

            const id = `example-${filename.substring(0, filename.length - '.js'.length)}`;
            const filepath = path.join(__dirname, exampleFolder, filename);
            const code = await fs.readFile(filepath, 'utf8');

            scripts[id] = {
              code,
              version: 2,
            };

            this.log(`Found Example: ${id}`);
          }),
        );
      } catch (err) {
        this.error('Examples Error:', err);
      }

      // Check for existing (SDK2) scripts in /userdata
      try {
        const files = await fs.readdir(path.join(__dirname, 'userdata', 'scripts'));
        await Promise.all(
          files.map(async (filename) => {
            if (!filename.endsWith('.js')) return;

            const id = filename.substring(0, filename.length - '.js'.length);
            const filepath = path.join(__dirname, 'userdata', 'scripts', filename);
            const code = await fs.readFile(filepath, 'utf8');

            scripts[id] = {
              code,
              lastExecuted: new Date(this.homey.settings.get(`last-execution-${id}`)),
            };

            this.log(`Found Migration: ${id}`);
          }),
        );
      } catch (err) {
        this.error('Migration Error:', err);
      }

      this.scripts = scripts;
      this.homey.settings.set('scripts', this.scripts);
    }

    // Migration
    if (this.scripts) {
      const scriptEntries = Object.entries(this.scripts);
      let anyScriptChanged = false;

      for (const [scriptId, script] of scriptEntries) {
        if (typeof script.name !== 'string') {
          anyScriptChanged = true;
          script.name = scriptId;
          script.id = scriptId;
        }

        if (typeof script.version !== 'number') {
          anyScriptChanged = true;
          script.version = 1;
        }
      }

      if (anyScriptChanged) {
        this.homey.settings.set('scripts', this.scripts);
      }
    }

    this.scriptExecution = new ScriptExecution(this);
    this.scriptExecution.initialize();
    this.homey.once('unload', () => {
      this.scriptExecution.stop();
    });
    this.scriptWidgets = new ScriptWidgets(this);

    const widgetIds = [
      'script-result',
      'script-button',
      'script-result-transparent',
      'script-button-transparent',
    ];

    for (const widgetId of widgetIds) {
      this.homey.dashboards
        .getWidget(widgetId)
        .registerSettingAutocompleteListener('script', async (query) => {
          return await this.onFlowGetScriptAutocomplete(query);
        });
    }

    // Register Flow Cards
    this.runCondition = new RunCondition({ homey: this.homey });
    this.runWithArgCondition = new RunWithArgCondition({ homey: this.homey });
    this.runCodeCondition = new RunCodeCondition({ homey: this.homey });
    this.runCodeWithArgCondition = new RunCodeWithArgCondition({ homey: this.homey });

    this.runAction = new RunAction({ homey: this.homey });
    this.runWithArgAction = new RunWithArgAction({ homey: this.homey });
    this.runCodeAction = new RunCodeAction({ homey: this.homey });
    this.runCodeReturnsStringAction = new RunCodeReturnsStringAction({ homey: this.homey });
    this.runCodeReturnsNumberAction = new RunCodeReturnsNumberAction({ homey: this.homey });
    this.runCodeReturnsBooleanAction = new RunCodeReturnsBooleanAction({ homey: this.homey });
    this.runCodeWithArgAction = new RunCodeWithArgAction({ homey: this.homey });
    this.runCodeWithArgReturnsStringAction = new RunCodeWithArgReturnsStringAction({
      homey: this.homey,
    });
    this.runCodeWithArgReturnsNumberAction = new RunCodeWithArgReturnsNumberAction({
      homey: this.homey,
    });
    this.runCodeWithArgReturnsBooleanAction = new RunCodeWithArgReturnsBooleanAction({
      homey: this.homey,
    });

    // Register Flow Tokens
    this.tokens = this.homey.settings.get('tokens') || {};
    this.tokensInstances = {};

    await Promise.all(
      Object.keys(this.tokens).map(async (id) => {
        this.tokensInstances[id] = await this.homey.flow.createToken(id, {
          title: id,
          type: this.tokens[id].type,
          value: this.tokens[id].value,
        });
      }),
    ).catch(this.error);
  }

  createAppApi() {
    if (this.homey.platform === 'local' && this.homey.platformVersion === 1) {
      return new HomeyAPIV2(this.apiProps);
    }

    if (this.homey.platform === 'local' && this.homey.platformVersion >= 2) {
      return new HomeyAPIV3Local(this.apiProps);
    }

    throw new Error('Not Supported');
  }

  getHomeyAPI({ version }) {
    if (version >= 2) {
      const api = this.createAppApi();
      return api;
    }

    const api = new HomeyAPILegacy(
      {
        localUrl: this.localUrl,
        baseUrl: this.localUrl,
        token: this.sessionToken,
        apiVersion: 2,
        online: true,
      },
      () => {
        // called by HomeyAPI on 401 requests
        api.setToken(this.sessionToken);
      },
    );

    return api;
  }

  async onFlowGetScriptAutocomplete(query) {
    const scripts = await this.getScripts();

    return Object.values(scripts)
      .filter((script) => script.name.toLowerCase().includes(query.toLowerCase()))
      .map((script) => ({
        id: script.id,
        name: script.name,
      }));
  }

  async setToken({ id, value, type = typeof value }) {
    // Delete the Token
    if (typeof value === 'undefined' || value === null) {
      if (this.tokensInstances[id]) {
        await this.tokensInstances[id].unregister().catch(this.error);
      }

      if (this.tokens[id]) {
        delete this.tokens[id];
        delete this.tokensInstances[id];
        this.homey.settings.set('tokens', this.tokens);
      }

      return;
    }

    // Create the Token
    if (!this.tokensInstances[id]) {
      this.tokensInstances[id] = await this.homey.flow.createToken(id, {
        type,
        value,
        title: id,
      });

      this.tokens[id] = { type, value };
      this.homey.settings.set('tokens', this.tokens);

      return;
    }

    // Update the Token
    if (this.tokensInstances[id]) {
      await this.tokensInstances[id].setValue(value);

      this.tokens[id].value = value;
      this.homey.settings.set('tokens', this.tokens);
    }
  }

  async getScripts() {
    const scripts = {};

    for (const [id, script] of Object.entries(this.scripts)) {
      scripts[id] = { ...script, lastExecuted: this.scriptExecution.getLastExecuted(id) };
    }

    return scripts;
  }

  async getScript({ id }) {
    const script = this.scripts[id];

    if (!Object.hasOwn(this.scripts, id)) {
      throw new Error('Script Not Found');
    }

    return {
      ...script,
      lastExecuted: new Date(this.scriptExecution.getLastExecuted(id)),
    };
  }

  async runScript({
    id,
    name,
    code,
    lastExecuted,
    args = [],
    version,
    realtime = true,
    onWidgetResult,
    widgetEvent = null,
  }) {
    if (lastExecuted == null) {
      const previousExecution = this.scriptExecution.getLastExecuted(id);
      lastExecuted = previousExecution === null ? new Date() : new Date(previousExecution);
    }

    const homeyAPI = this.getHomeyAPI({ version });

    // Create a Logger
    const log = (...props) => {
      this.log(`[${name}]`, ...props);

      if (realtime) {
        this.homey.api.realtime('log', {
          text: util.format(...props),
          script: id,
        });
      }
    };

    // Create the Context
    const context = vm.createContext({
      args,
      widgetEvent: widgetEvent === null ? null : JSON.parse(JSON.stringify(widgetEvent)),

      // 3rd party modules
      _,
      fetch,
      http,
      https,
      URLSearchParams,
      Buffer,

      // System
      __filename__: `${name}.js`,
      __script_id__: id,
      __last_executed__: lastExecuted,
      __ms_since_last_executed__: Date.now() - lastExecuted.getTime(),

      // Homey API
      Homey: homeyAPI,
      WidgetResult,
      WidgetValidationError,

      // Logging
      log,
      console: {
        log,
        error: log,
        info: log,
      },

      // Shortcuts
      say: async (text) => {
        return await homeyAPI.speechOutput.say({ text });
      },
      tag: async (id, value) => {
        return await this.setToken({ id, value });
      },
      wait: async (delay) => {
        return await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      },

      // Cross-Script Settings
      global: {
        get: (key) => {
          return this.homey.settings.get(`homeyscript-${key}`);
        },
        set: (key, value) => {
          return this.homey.settings.set(`homeyscript-${key}`, value);
        },
        keys: () => {
          return this.homey.settings
            .getKeys()
            .filter((key) => {
              return key.startsWith('homeyscript-');
            })
            .map((key) => {
              return key.substring('homeyscript-'.length);
            });
        },
      },

      // Deprecated
      setTagValue: async (id, opts, value) => {
        log('Warning: setTagValue(id, opts, value) is deprecated, please use tag(id, value)');
        await this.setToken({
          id,
          value,
          type: opts.type,
        });
      },
    });

    try {
      // Create the Sandbox
      const sandbox = new vm.Script(`Promise.resolve().then(async () => {\n${code}\n});`, {
        filename: `${name}.js`,
        lineOffset: -1,
        columnOffset: 0,
      });

      const runPromise = sandbox.runInNewContext(context, {
        displayErrors: true,
        timeout: this.constructor.RUN_TIMEOUT,
        microtaskMode: 'afterEvaluate', // from Node 14 should properly timeout async script
      });

      const result = await runPromise;
      log('\n———————————————————\n✅ Script Success\n');
      log('↩️ Returned:', JSON.stringify(result, false, 2));
      const widgetResult = this.scriptWidgets.record(id, { success: true, value: result });
      onWidgetResult?.(widgetResult);
      return result;
    } catch (err) {
      const widgetResult = this.scriptWidgets.record(id, {
        success: false,
        error: err.message,
        validationError: WidgetValidationError.getDetails(err),
      });
      onWidgetResult?.(widgetResult);
      log('\n———————————————————\n❌ Script Error\n');
      log('⚠️', err.stack);
      // Create a new Error because an Error from the sandbox behaves differently
      const error = new Error(err.message, { cause: err });
      error.stack = err.stack;
      throw error;
    } finally {
      this.scriptExecution.record(id);

      if (homeyAPI) {
        homeyAPI.destroy();
      }
    }
  }

  async createScript({ name, code }) {
    const newScript = {
      id: uuid.v4(),
      name,
      code,
      version: 2,
    };

    this.scripts[newScript.id] = newScript;
    this.homey.settings.set('scripts', this.scripts);

    return { ...newScript, lastExecuted: null };
  }

  async updateScript({ id, name, code, lastExecuted, version }) {
    if (!Object.hasOwn(this.scripts, id)) {
      throw new Error('Script Not Found');
    }

    const definitionChanged = name != null || code != null || version != null;

    if (definitionChanged) {
      const script = { ...this.scripts[id] };

      if (name != null) {
        script.name = name;
      }

      if (code != null) {
        script.code = code;
      }

      if (version != null) {
        script.version = version;
      }

      this.scripts[id] = script;
      this.homey.settings.set('scripts', this.scripts);
    }

    if (lastExecuted != null) {
      this.scriptExecution.record(id, lastExecuted);
    }

    return { ...this.scripts[id], lastExecuted: this.scriptExecution.getLastExecuted(id) };
  }

  async deleteScript({ id }) {
    delete this.scripts[id];
    this.scriptWidgets.results.delete(id);
    this.scriptExecution.delete(id);
    this.homey.settings.set('scripts', this.scripts);
  }
};
