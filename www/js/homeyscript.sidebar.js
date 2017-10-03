function Sidebar( api, editor ) {

	this._scripts = [];
	this._activeFileEl = undefined;
	this._ctxmenuEl = undefined;

	this._api = api;
	this._app = null;
	this._editor = editor;

	this._api.registerAppListener( this._onApp.bind(this) );

	this._sidebarEl = document.querySelector('.hs-sidebar');
	this._filesEl = this._sidebarEl.querySelector('.hs-files');
	this._actionsEl = this._sidebarEl.querySelector('.hs-actions');
	this._buttonCreateEl = this._sidebarEl.querySelector('.hs-actions .button.create');
	this._buttonCreateEl.addEventListener('click', this.createScript.bind(this));

}

Sidebar.prototype.init = function(){
	this.render();
}

Sidebar.prototype.render = function(){

	this._filesEl.innerHTML = '';

	this._scripts.forEach(function(scriptId){
		var fileEl = document.createElement('div');
			fileEl.classList.add('hs-file', 'hs-transition');
			fileEl.addEventListener('click', function(e){
				this._editor.open( scriptId );

				if( this._activeFileEl )
					this._activeFileEl.classList.remove('hs-active');

				this._activeFileEl = fileEl;
				this._activeFileEl.classList.add('hs-active');
			}.bind(this));
			fileEl.addEventListener('contextmenu', function(e){
				e.preventDefault();

				this._destroyCtxmenu();

				var rect = this._filesEl.getBoundingClientRect();

				window.addEventListener('click', this._destroyCtxmenu.bind(this));

				this._ctxmenuEl = document.createElement('div');
				this._ctxmenuEl.classList.add('ctxmenu');
				this._ctxmenuEl.style.top = ( e.clientY - rect.top ) + 'px';
				this._ctxmenuEl.style.left = ( e.clientX - rect.left ) + 'px';
				this._ctxmenuEl.addEventListener('click', function(e){
					e.stopPropagation();
				});
				this._filesEl.appendChild(this._ctxmenuEl);

				var deleteFileEl = document.createElement('div');
					deleteFileEl.classList.add('item');
					deleteFileEl.textContent = 'Delete';
					deleteFileEl.addEventListener('click', function(e){
						this.deleteScript( scriptId );
						this._destroyCtxmenu();
					}.bind(this));
				this._ctxmenuEl.appendChild(deleteFileEl);

			}.bind(this));

		var fileIconEl = document.createElement('i');
			fileIconEl.classList.add('fa', 'fa-file-o');
		fileEl.appendChild(fileIconEl);

		var fileNameEl = document.createElement('span');
			fileNameEl.textContent = scriptId;
		fileEl.appendChild(fileNameEl);

		this._filesEl.appendChild(fileEl);
	}.bind(this));

}

Sidebar.prototype._destroyCtxmenu = function() {

	if( this._ctxmenuEl ) {
		this._filesEl.removeChild(this._ctxmenuEl);
		this._ctxmenuEl = null;
	}

}

Sidebar.prototype._onApp = function( app ) {
	this._app = app;
	this._refreshScripts();

	if( this._app ) {
		this._actionsEl.style.visibility = 'visible';
	} else {
		this._actionsEl.style.visibility = 'hidden';
	}
}

Sidebar.prototype._refreshScripts = function(){

	if( this._app ) {
		this._app.apiGet('script')
			.then(function(scripts){
				this._scripts = scripts;
				this.render();
			}.bind(this))
			.catch(function(err){
				console.error(err);
				alert(err);
			})
	} else {
		this._scripts = [];
		this.render();
	}

}

Sidebar.prototype.deleteScript = function( scriptId ) {
	this._app.apiDelete('script/' + scriptId)
		.then(function(scripts){
			this._refreshScripts();
		}.bind(this))
}

Sidebar.prototype.createScript = function() {

	var scriptId = prompt("Please enter your script name.");
	if( scriptId === null | scriptId.length < 1 ) return;
	if( this._scripts.indexOf(scriptId) > -1 ) return alert("That name already exists. Please choose a unique name.");

	this._app.apiPut('script/' + scriptId, { code: '// my script' })
		.then(function(scripts){
			this._refreshScripts();
			this._editor.open( scriptId );
		}.bind(this))
}
