function Editor( api, topbar ) {

	this._api = api;
	this._api.registerAppListener( this._onApiApp.bind(this) );

	this._editorsEl = document.querySelector('.hs-editors');
	this._editors = {};
	this._activeScriptId = null;

	this._onLog = this._onLog.bind(this);

}

Editor.prototype.init = function(){

}

Editor.prototype._initEditor = function( scriptId, code ) {

	var editorEl = document.createElement('div');
		editorEl.classList.add('hs-editor');
	this._editorsEl.appendChild(editorEl);

	var monacoEl = document.createElement('div');
		monacoEl.classList.add('hs-monaco');
	editorEl.appendChild( monacoEl );

	var consoleEl = document.createElement('div');
		consoleEl.classList.add('hs-console');
	editorEl.appendChild( consoleEl );

	var consoleHeaderEl = document.createElement('div');
		consoleHeaderEl.classList.add('hs-console-header');
		consoleHeaderEl.innerHTML = '<i class="fa fa-terminal" aria-hidden="true"></i> Console';
	consoleEl.appendChild( consoleHeaderEl );

	var consoleInnerEl = document.createElement('div');
		consoleInnerEl.classList.add('hs-console-inner');
		consoleInnerEl.classList.add('hs-scrollbar');
	consoleEl.appendChild( consoleInnerEl );

	this._editors[ scriptId ] = {
		element: editorEl,
		console: consoleEl,
		consoleInner: consoleInnerEl,
		monaco: monaco.editor.create(monacoEl, {
			value: code,
			language: 'javascript',
			theme: 'vs-dark',
			automaticLayout: true
		})
	}
	this._editors[ scriptId ].monaco.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, this.save.bind(this))
	this._editors[ scriptId ].monaco.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_W, this.close.bind(this));
	this._editors[ scriptId ].monaco.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KEY_R, this.run.bind(this));

	this._showEditor( scriptId );
}

Editor.prototype._showEditor = function( scriptId ) {

	for( var editorId in this._editors ) {
		this._editors[ editorId ].element.classList.toggle('active', editorId === scriptId);
	}

	this._activeScriptId = scriptId;

	document.body.classList.toggle('editing', true);

}

Editor.prototype.open = function( scriptId ) {

	if( this._editors[ scriptId ] )
		return this._showEditor( scriptId );

	this._app.apiGet('script/' + scriptId)
		.then(function(script){
			this._initEditor( scriptId, script.code );
		}.bind(this))
		.catch(function(err){
			console.error(err);
			alert(err);
		})

}

Editor.prototype.close = function( scriptId ){
	scriptId = scriptId || this._activeScriptId;

	var editor = this._editors[ scriptId ];
	if( editor ) {
		editor.monaco.dispose();
		this._editorsEl.removeChild( editor.element );
		delete this._editors[ scriptId ];

		if( this._activeScriptId === scriptId )
			this._activeScriptId = null;
	}
}

Editor.prototype.closeAll = function() {
	for( var editorId in this._editors ) {
		this.close( editorId );
	}

	document.body.classList.toggle('editing', false);
}

Editor.prototype.save = function() {

	var code = this._editors[ this._activeScriptId ].monaco.getValue();

	return this._app.apiPut('script/' + this._activeScriptId, {
		code: code
	})
		.catch(function(err){
			console.error(err);
			alert(err);
		})
}

Editor.prototype.run = function() {

	var editor = this._editors[ this._activeScriptId ];
	if( editor ) {
		editor.consoleInner.textContent = '';
	}

	var scriptId = this._activeScriptId;

	this._app.apiPost('script/' + scriptId + '/run', {})
		.then(function(result){
			
			if( result.success) {
				//this.log( scriptId, 'Script returned:');
				//this.log( scriptId, JSON.stringify(result.returns) );				
			} else {
				this.log( scriptId, '');
				this.log( scriptId, '----------------');
				this.log( scriptId, 'Script Error:' );
				this.log( scriptId, result.returns ? result.returns.message : result.returns );
			}
		}.bind(this))
		.catch(function(err){
			console.error(err);
			alert(err.message || err.toString());
		})
}

Editor.prototype._onApiApp = function( app ) {

	if( this._app ) {
		this._app.removeListener('log', this._onLog);
		this.closeAll();
	}

	this._app = app;

	if( this._app ) {
		this._app.on('log', this._onLog);
	}
}

Editor.prototype._onLog = function( log ) {
	this.log( log.script, log.text );
}

Editor.prototype.log = function( scriptId, logText ) {

	var editor = this._editors[ scriptId ];
	if( editor ) {
		editor.consoleInner.textContent += logText + '\n';
	}

}
