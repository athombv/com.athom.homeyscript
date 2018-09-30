'use strict';

const Homey = require('homey');
const util = require('util');
const _ = require('lodash');
const fetch = require('node-fetch')
const FTManager = require('./FlowTokenManager');

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

    async setTagValue(id, opts, value) {
      return await FTManager.setTokenValue(id, opts, value);
    }
}

module.exports = SandboxAPI;
