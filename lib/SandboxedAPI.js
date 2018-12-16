'use strict';

const Homey = require('homey');
const util = require('util');
const _ = require('lodash');
const fetch = require('node-fetch')
const FTManager = require('./FlowTokenManager');
const {ManagerSettings} = require('homey');

const globalPrefix = 'homeyscript-';
const lastExecution = 'homeyscript-last-exec';

class SandboxAPI {
    constructor(args, api, filename, scriptId) {
        this.Homey = api;
        this.args = args;
        this.__filename__ = filename;
        this.__script_id__ = scriptId;

        this._ = _;
        this.fetch = fetch;

        this.___setResult = this.___setResult.bind(this);
        this.log = this.log.bind(this);
        this.say = this.say.bind(this);
        this.getGlobal = this.getGlobal.bind(this);
        this.setGlobal = this.setGlobal.bind(this);
        this.allGlobals = this.allGlobals.bind(this);
        this.msSinceLastRun = this.msSinceLastRun.bind(this);

        this.console = {
            log: this.log,
            error: this.log,
            info: this.log,
        };
    }

    ___setResult(prom) {
        this.result = prom;
    }

    log(...args) {
        Homey.app.addLogEntry(this.__script_id__, util.format.apply(null, args));
    }

    say(text) {
        return this.Homey.speechOutput.say({text:text});
    }

    getGlobal(key) {
        return ManagerSettings.get(globalPrefix + key);
    }

    setGlobal(key, value) {
        ManagerSettings.set(globalPrefix + key, value);
    }

    allGlobals() {
        return _.filter(ManagerSettings.getKeys(), key => key.startsWith(globalPrefix))
            .map(key => key.substr(globalPrefix.length));
	 }
	 
	 msSinceLastRun() {
		 let now = new Date().valueOf();
		 let last = ManagerSettings.get(lastExecution);
		 ManagerSettings.set(lastExecution, now);
		 return now - (last ? last : 0);
	 }

    async setTagValue(id, opts, value) {
      return await FTManager.setTokenValue(id, opts, value);
    }
}

module.exports = SandboxAPI;
