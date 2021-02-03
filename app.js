'use strict';

const fs = require('fs').promises;
const vm = require('vm');
const util = require('util');
const path = require('path');

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');
const fetch = require('node-fetch');
const _ = require('lodash');

module.exports = class HomeyScriptApp extends Homey.App {

  static RUN_TIMEOUT = 1000 * 30; // 30s

  async onInit() {
    // Init Scripts
    this.scripts = this.homey.settings.get('scripts');

    this.localURL = await this.homey.api.getLocalUrl();
    this.sessionToken = await this.homey.api.getOwnerApiToken();

    if (!this.scripts) {
      this.log('No scripts found.');

      const scripts = {};

      // Copy example scripts
      try {
        const files = await fs.readdir(path.join(__dirname, 'examples'));
        await Promise.all(files.map(async filename => {
          if (!filename.endsWith('.js')) return;

          const id = 'example-' + filename.substring(0, filename.length - '.js'.length);
          const filepath = path.join(__dirname, 'examples', filename);
          const code = await fs.readFile(filepath, 'utf8');

          scripts[id] = {
            code,
            lastExecuted: null,
          };

          this.log(`Found Example: ${id}`);
        }));
      } catch (err) {
        this.error('Examples Error:', err);
      }

      // Check for existing (SDK2) scripts in /userdata
      try {
        const files = await fs.readdir(path.join(__dirname, 'userdata', 'scripts'));
        await Promise.all(files.map(async filename => {
          if (!filename.endsWith('.js')) return;

          const id = filename.substring(0, filename.length - '.js'.length);
          const filepath = path.join(__dirname, 'userdata', 'scripts', filename);
          const code = await fs.readFile(filepath, 'utf8');

          scripts[id] = {
            code,
            lastExecuted: new Date(this.homey.settings.get(`last-execution-${id}`)),
          };

          this.log(`Found Migration: ${id}`);
        }));
      } catch (err) {
        this.error('Migration Error:', err);
      }

      this.scripts = scripts;
      this.homey.settings.set('scripts', this.scripts);
    }

    // Register Flow Cards
    this.homey.flow.getConditionCard('run')
      .registerRunListener(async ({ script }) => {
        const { id } = script;
        return this.runScript({
          id,
          realtime: false,
        });
      })
      .registerArgumentAutocompleteListener('script', query => this.onFlowGetScriptAutocomplete(query));

    this.homey.flow.getConditionCard('runWithArg')
      .registerRunListener(async ({ script, argument }) => {
        const { id } = script;
        return this.runScript({
          id,
          args: [argument],
          realtime: false,
        });
      })
      .registerArgumentAutocompleteListener('script', query => this.onFlowGetScriptAutocomplete(query));

    this.homey.flow.getActionCard('run')
      .registerRunListener(async ({ script }) => {
        const { id } = script;
        return this.runScript({
          id,
          realtime: false,
        });
      })
      .registerArgumentAutocompleteListener('script', query => this.onFlowGetScriptAutocomplete(query));

    this.homey.flow.getActionCard('runWithArg')
      .registerRunListener(async ({ script, argument }) => {
        const { id } = script;
        return this.runScript({
          id,
          args: [argument],
          realtime: false,
        });
      })
      .registerArgumentAutocompleteListener('script', query => this.onFlowGetScriptAutocomplete(query));

    // Register Flow Tokens
    this.tokens = this.homey.settings.get('tokens') || {};
    this.tokensInstances = {};

    await Promise.all(Object.keys(this.tokens).map(async id => {
      this.tokensInstances[id] = await this.homey.flow.createToken(id, {
        title: id,
        type: this.tokens[id].type,
        value: this.tokens[id].value,
      });
    })).catch(this.error);
  }

  async getHomeyAPI() {
    const api = new HomeyAPI({
        localUrl: this.localURL,
        baseUrl: this.localURL,
        token: this.sessionToken,
        apiVersion: 2,
        online: true
      },
      () => {
        // called by HomeyAPI on 401 requests
        api.setToken(this.sessionToken);
      }
    );

    return api;
  }

  async onFlowGetScriptAutocomplete(query) {
    const scripts = await this.getScripts();
    return Object.keys(scripts)
      .filter(id => id.toLowerCase().includes(query.toLowerCase()))
      .map(id => ({
        id,
        name: id,
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

      return;
    }
  }

  async getScripts() {
    return this.scripts;
  }

  async getScript({ id }) {
    const script = this.scripts[id];
    if (!script) {
      throw new Error('Script Not Found');
    }

    return {
      ...script,
      lastExecuted: new Date(script.lastExecuted),
    };
  }

  async runScript({
    id,
    code,
    args = [],
    realtime = true,
  }) {

    // Get the Script
    const script = await this.getScript({ id });

    const homeyAPI = await this.getHomeyAPI();

    // Create a Logger
    const log = (...props) => {
      this.log(`[${id}]`, ...props);

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

      // 3rd party modules
      _,
      fetch,

      // System
      __filename__: `${id}.js`,
      __script_id__: id,
      __last_executed__: script.lastExecuted,
      __ms_since_last_executed__: Date.now() - script.lastExecuted.getTime(),

      // Homey API
      Homey: homeyAPI,

      // Logging
      log: log,
      console: {
        log: log,
        error: log,
        info: log,
      },

      // Shortcuts
      say: async (text) => await homeyAPI.speechOutput.say({ text }),
      tag: async (id, value) => await this.setToken({ id, value }),
      wait: async (delay) => new Promise(resolve => setTimeout(resolve, delay)),

      // Cross-Script Settings
      global: {
        get: (key) => this.homey.settings.get(`homeyscript-${key}`),
        set: (key, value) => this.homey.settings.set(`homeyscript-${key}`, value),
        keys: () => this.homey.settings.getKeys()
          .filter(key => key.startsWith('homeyscript-'))
          .map(key => key.substring('homeyscript-'.length)),
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

    // Create the Sandbox
    const sandbox = new vm.Script(`Promise.resolve().then(async () => {\n${code || script.code}\n});`, {
      filename: `${id}.js`,
      lineOffset: -1,
      columnOffset: 0,
    });

    const runPromise = sandbox.runInNewContext(context, {
      displayErrors: true,
      timeout: this.constructor.RUN_TIMEOUT,
      microtaskMode: "afterEvaluate" // from Node 14 should properly timeout async script
    });

    script.lastExecuted = new Date();
    this.homey.settings.set('scripts', this.scripts);

    try {
      const result = await runPromise;
      log('\n----------------\nScript Success:\n');
      log(JSON.stringify(result, false, 2));
      return result;
    } catch (err) {
      log('\n----------------\nScript Error:\n');
      log(err.stack);
      // Create a new Error because an Error from the sandbox behaves differently
      const error = new Error(err.message);
      error.stack = error.stack;
      throw error;
    } finally {
      homeyAPI && homeyAPI.destroy();
    }
  }

  async updateScript({ id, code }) {
    this.scripts[id] = this.scripts[id] || {};
    this.scripts[id].code = code;
    this.homey.settings.set('scripts', this.scripts);

  }

  async deleteScript({ id }) {
    delete this.scripts[id];
    this.homey.settings.set('scripts', this.scripts);
  }

}