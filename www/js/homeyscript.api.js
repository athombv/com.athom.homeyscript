function Api() {
	
	this.homeys = {};
	this.user = null;
	this.homey = null;
	this.app = null;
	this._userListeners = [];
	this._homeyListeners = [];
	this._appListeners = [];
	
	this._api = new window.AthomAPI.AthomCloudAPI({
	    clientId: '59a0024918d14b410df56237',
	    clientSecret: '5c3501126f0bca9f8f76f6291ed5b09f0fdba97f',
		redirectUrl: window.location.protocol + '//' + window.location.host,
	});
	
}

Api.prototype.init = function( callback ){
	var getHomeyScriptAPI = function() {
		return this._api.getAuthenticatedUser()
			.then(function(user){				
				this._userListeners.forEach(function(userListener){
					userListener.call( userListener, user );
				}.bind(this));
				
				return user.getFirstHomey();
			}.bind(this))
			.then(function(homey){
				
				this._homeyListeners.forEach(function(homeyListeners){
					homeyListeners.call( homeyListeners, homey );
				}.bind(this));
				
				return homey.authenticate();
			}.bind(this))
			.then(function(homeyApi){			
				return homeyApi.apps.getApp({ id: 'com.athom.homeyscript' })
			}.bind(this))
			.then(function(app){
    			if(!app.running && app.state !== 'running')
    				throw new Error('The HomeyScript app is not running. Please enable it.');
    				
				this._appListeners.forEach(function(appListener){
					appListener.call( appListener, app );
				}.bind(this));
			}.bind(this))
			.catch(function(err){
				if( err && err.code === 404 )
					err = new Error('The HomeyScript app has not been installed on this Homey.\nPlease install it from the Homey Apps Store.');
					
				callback(err);
			}.bind(this))
	}.bind(this);
	
	this._api.isLoggedIn().then(function(isLoggedIn){
		if(isLoggedIn) {
			getHomeyScriptAPI()
				.then(callback)
				.catch(callback)
		} else {
			if(this._api.hasAuthorizationCode()) {
				this._api.authenticateWithAuthorizationCode()
					.then(getHomeyScriptAPI)		
					.then(callback)
					.catch(callback)
			    	.then(function(){
						window.history.pushState({}, '', '/');
				    })
			} else {
				this.login();		
			}	
		}
	}.bind(this));
}

Api.prototype.login = function(){
	window.location.href = this._api.getLoginUrl();	
}

Api.prototype.logout = function(){
	this._api.logout();
	window.location.reload();
}

Api.prototype.registerUserListener = function( callback ) {
	this._userListeners.push( callback );
}

Api.prototype.registerHomeyListener = function( callback ) {
	this._homeyListeners.push( callback );
}

Api.prototype.registerAppListener = function( callback ) {
	this._appListeners.push( callback );
}