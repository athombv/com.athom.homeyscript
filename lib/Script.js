'use strict';
const Sandbox = require('./ScriptSandbox.js');

class Script {
	
	constructor( id, code ) {
		this.code = code;
		this.id = id;
		this._vm = new Sandbox(this);
	}
	
	get filename() {
    	return this.id + '.js';
	}
	
	toJSON() {
		return {
			code: this.code,
			id: this.id
		}
	}
	
	async run(args) {
    	return await this._vm.run(args);
	}
	
}

module.exports = Script;