'use strict';

const vm = require('vm');

const {HomeyAPI} = require('athom-api');
const uuid = require('uuid');

const SandboxedAPI = require('./SandboxedAPI.js');

const SCRIPT_RUN_TIMEOUT = 30 * 1000;

class ScriptSandbox {
    
    constructor(script) {
        this._opts = script;
        this._script = new vm.Script(this._prepareCode(script.code), {
            filename: script.filename,
            lineOffset: -1,
            columnOffset: 0,
            displayErrors: true,
            timeout: SCRIPT_RUN_TIMEOUT,
        });
    }
    
    async run(args) {
        if(!this._api) this._api = HomeyAPI.forCurrentHomey();
        this._api = await this._api;
        const sandbox = new SandboxedAPI(args, this._api, this._opts.filename, this._opts.id);
        try {
            this._script.runInNewContext(sandbox);
            const result = await sandbox.result;
            this._api.destroy();
            sandbox.log( '\n----------------\nScript returned:\n', result );
            return result;
        } catch(err) {
            this._api.destroy();
            const newError = new Error(err.message);
            newError.name = err.name;
            newError.stack = err.stack;
            throw newError;
        }

    }
    
    _prepareCode(code) {
        return `___setResult(async function() {\n${code}\n}());`;
    }
}

module.exports = ScriptSandbox;