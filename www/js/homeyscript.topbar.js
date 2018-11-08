function Topbar( api, editor ) {	
	
	this._api = api;
	this._editor = editor;
	
	this._api.registerHomeyListener(this._onApiHomey.bind(this));
	this._api.registerUserListener(this._onApiUser.bind(this));
	
	this._el = document.querySelector('.hs-header');
	
	this._buttonSaveEl = this._el.querySelector('.button.save');
	this._buttonSaveEl.addEventListener('click', this._onButtonSave.bind(this));
	this._buttonRunEl = this._el.querySelector('.button.run');
	this._buttonRunEl.addEventListener('click', this._onButtonRun.bind(this));
	
	this._homeyEl = this._el.querySelector('.homey');
	
	this._userEl = this._el.querySelector('.user');
	this._userEl.addEventListener('click', this._onUserClick.bind(this));
	this._userNameEl = this._userEl.querySelector('.name');
	this._userAvatarEl = this._userEl.querySelector('.avatar');
}

Topbar.prototype.init = function( api ){
}

Topbar.prototype._onApiHomey = function( homey ) {
	this._homeyEl.textContent = homey.name;
	this._homeyEl.title = 'v' + homey.softwareVersion;
}

Topbar.prototype._onApiUser = function( user ) {
	this._userNameEl.textContent = user.fullname;
	this._userAvatarEl.src = user.avatar.small;
}

Topbar.prototype._onButtonSave = function( e ) {
	this._editor.save();
}

Topbar.prototype._onButtonRun = function( e ) {
	this._editor.save()
		.then(function(){
			this._editor.run();				
		}.bind(this));
}

Topbar.prototype._onUserClick = function( e ) {
	this._api.logout();
}