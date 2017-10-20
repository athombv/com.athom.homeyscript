'use strict';

const fse = require('fs-extra');
const path = require('path');
const Homey = require('homey');
const Script = require('./lib/Script.js');

class HomeyScriptApp extends Homey.App {
	
	async onInit() {
		
		this._examplesPath = './examples';
		this._scriptsPath = './userdata/scripts';
		this._scripts = {};
		
		try {
			this._initScripts();
		} catch( err ) {
			this.error( err );
		}
		
		this._initFlow();
		
		this.log('HomeyScript is running...');
		
	}
	
	_initFlow() {
		
		new Homey.FlowCardCondition('run')
			.register()
			.registerRunListener( args => {
				return this.runScript( args.script.id );
			})
			.getArgument('script')
			.registerAutocompleteListener( this._onFlowAutocomplete.bind(this) )
			
		new Homey.FlowCardCondition('runWithArg')
			.register()
			.registerRunListener( args => {
				return this.runScript( args.script.id, [args.argument] );
			})
			.getArgument('script')
			.registerAutocompleteListener( this._onFlowAutocomplete.bind(this) )
		
		new Homey.FlowCardAction('run')
			.register()
			.registerRunListener( args => {
				return this.runScript( args.script.id );
			})
			.getArgument('script')
			.registerAutocompleteListener( this._onFlowAutocomplete.bind(this) )
			
		new Homey.FlowCardAction('runWithArg')
			.register()
			.registerRunListener( args => {
				return this.runScript( args.script.id, [args.argument] );
			})
			.getArgument('script')
			.registerAutocompleteListener( this._onFlowAutocomplete.bind(this) )
		
		
	}
	
	_onFlowAutocomplete( query, args ) {
		
		let resultArr = [];
		this.getScripts().forEach( script => {
			resultArr.push({
				id: script,
				name: script
			});
		});
		
		return Promise.resolve( resultArr );
	}
		
	getScripts() {
		return Object.keys(this._scripts);
	}
	
	getScript( scriptId ) {
		const result = this._scripts[ scriptId ];
		if(!result) throw new Error('invalid_script');
		return result;
	}
	
	async _initScripts() {
		
		// if new boot, copy examples
		let exists = await fse.pathExists( this._scriptsPath ); 
		if( exists === false ) {	
			
			let examples = await fse.readdir( this._examplesPath );
			
			// remove path
			examples = examples.map( file => {
				return path.basename( file );
			});
				
			// copy files
			for(let i = 0; i < examples.length; i++) {
				const script = examples[i];
				console.log('copying example script', script);
				const contents = await fse.readFile( path.join(this._examplesPath, script) );
				await fse.outputFile( path.join(this._scriptsPath, script), contents );
			}
		}
		
		// find scripts
		let files = await fse.readdir( this._scriptsPath );
		files
		
			// filter for .js
			.filter( file => {
				return file.lastIndexOf('.js') !== file.length - 4;
			})
			
			// remove path
			.map( file => {
				return path.basename( file );
			})
			
			// remove .js
			.map( file => {
				return file.substring(0, file.length - '.js'.length);
			})
			
			// initialize the scripts
			.forEach( async scriptId => {
				await this._initScript( scriptId );
			});
	}
	
	async _initScript( scriptId ) {
		console.log('_initScript', scriptId);
		
		let code = await fse.readFile( this._getScriptPath( scriptId ) );
			code = code.toString();
		
		this._scripts[ scriptId ] = new Script( scriptId, code );
		
	}
	
	async _uninitScript( scriptId ) {
		console.log('_uninitScript', scriptId);
		
		delete this._scripts[ scriptId ];
	
	}
	
	async runScript( scriptId, args ) {
		if(!Array.isArray(args)) args = [];
		return await this.getScript(scriptId).run(args);
	}
	
	async updateScript( scriptId, scriptObj ) {
		
		try {
			await this._uninitScript( scriptId );
		} catch( err ) {}
		
		await fse.writeFile( this._getScriptPath( scriptId ), scriptObj.code );	
		await this._initScript( scriptId );
		
		return this.getScript( scriptId );
	}
	
	async deleteScript( scriptId ) {
		await this._uninitScript( scriptId );
		await fse.unlink( this._getScriptPath( scriptId ) );
	}
	
	addLogEntry(script, text) {
		Homey.ManagerApi.realtime('log', {script, text});
	}
	
	_getScriptPath( scriptId ) {
		return `${this._scriptsPath}/${scriptId}.js`;
	}
	
}

module.exports = HomeyScriptApp;