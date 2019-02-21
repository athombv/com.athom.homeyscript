'use strict';
const Sandbox = require('./ScriptSandbox.js');
const {ManagerSettings} = require('homey');

class Script {
	
	constructor( id, code ) {
		this.code = code;
		this.id = id;
		this._vm = new Sandbox(this);
	}
	
	get filename() {
    	return this.id + '.js';
	}

	get lastExecuted() {
		return new Date(ManagerSettings.get('last-execution-'+this.id));
	}
	
	toJSON() {
		return {
			code: this.code,
			id: this.id,
			lastExecuted: this.lastExecuted,
		}
	}
	
	async run(args) {
		let result = await this._vm.run(args);
		ManagerSettings.set('last-execution-'+this.id, new Date())
		return result;
	}
	
}

module.exports = Script;