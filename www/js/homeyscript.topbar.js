function Topbar( api, editor ) {	
	
	this._api = api;
	this._editor = editor;
	
	this._api.registerUserListener(this._onApiUser.bind(this));
	
	this._el = document.querySelector('.hs-header');
	this._selectorEl = this._el.querySelector('.selector select')
	this._selectorEl.addEventListener('change', this._onSelectorChange.bind(this));
	
	this._buttonSaveEl = this._el.querySelector('.button.save');
	this._buttonSaveEl.addEventListener('click', this._onButtonSave.bind(this));
	this._buttonRunEl = this._el.querySelector('.button.run');
	this._buttonRunEl.addEventListener('click', this._onButtonRun.bind(this));
	
	this._userEl = this._el.querySelector('.user');
	this._userEl.addEventListener('click', this._onUserClick.bind(this));
	this._userNameEl = this._userEl.querySelector('.name');
	this._userAvatarEl = this._userEl.querySelector('.avatar');
}

Topbar.prototype.init = function( api ){
	
	this._selectorEl.removeAttribute('disabled');
		
	for( var homeyId in this._api.homeys ) {
		var homey = this._api.homeys[ homeyId ];
		
		var optionEl = document.createElement('option');
			optionEl.value = homey._id;
			optionEl.textContent = homey.name;
			
		if( homey.state !== 'online' || homey.role !== 'owner' )
			optionEl.disabled = 'disabled';
			
		this._selectorEl.appendChild( optionEl );		
	};
	
}

Topbar.prototype._onApiUser = function( user ) {
	this._userNameEl.textContent = user.firstname;
	this._userAvatarEl.src = user.avatar.small;
}

Topbar.prototype._onSelectorChange = function( e ) {
	var homeyId = e.target.value;
	this._api.setHomey( homeyId );
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