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
		redirectUrl: window.location.protocol + '//' + window.location.host
	});
		
	this._api
	    .on('token', function( token ) {	        
	        window.localStorage.setItem('token', JSON.stringify(token));
	    }.bind(this))
	    .on('logout', function(){
	        window.localStorage.removeItem('token');	
	        this._setUser( null );        
	    }.bind(this));
	
}

Api.prototype.init = function( callback ) {
	callback = callback || function(){}
	    
	this._auth(function(err){
		if( err ) return callback( err );
		
		this._api.getHomeys({})
			.then(function(homeys){
				homeys.forEach(function(homey){
					this.homeys[ homey._id ] = homey;
				}.bind(this));
			}.bind(this))
			.then(function(){
				callback();
			})
			.catch(function(err){
				callback(err);
			}.bind(this))
	}.bind(this));
}

Api.prototype._auth = function( callback ){
	
	var token = window.localStorage.getItem('token');
	var url = new URL( window.location.href );
	var code = url.searchParams.get('code');
	var error = url.searchParams.get('error_description');
	
	if( code ) {
    	if(error) {
        	window.history.pushState({}, '', '/');
        	return alert(error);
        }
	    this._api.authenticateWithAuthorizationCode( code )
			.then(function(){
				return this._api.getAuthenticatedUser();
			}.bind(this))
			.then(function(user){
				this.user = user;
				
				this._userListeners.forEach(function(userListener){
					userListener.call( userListener, this.user );
				}.bind(this));
			}.bind(this))
		    .then(function(){			    
				callback();
		    })
		    .catch(function( err ){
				callback( err );
			})
	    	.then(function(){
				window.history.pushState({}, '', '/');
		    })
	} else if( token ) {
		this._api.setAuthState( JSON.parse(token) )
			.then(function(){
				return this._api.getAuthenticatedUser();
			}.bind(this))
			.then(function(user){
				this.user = user;
				
				this._userListeners.forEach(function(userListener){
					userListener.call( userListener, this.user );
				}.bind(this));
			}.bind(this))
			.then(function(){
				callback();
			})
	} else {
		this.login();
	}
	
}

Api.prototype.login = function(){
	window.location.href = this._api.getLoginUrl();	
}

Api.prototype.logout = function(){
	window.localStorage.removeItem('token');
	this.user = null;
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

Api.prototype.setHomey = function( homeyId ) {
	if( this.homey && this.homey._id === homeyId ) return;
	
	if( this.homey )
		this.homey.destroy();
	
	var homey = this.homeys[ homeyId ];
	if( homey ) {
		homey.authenticate()
		
			.then(function(homey){
				if( this.homey ) this.homey.destroy();
				this.homey = homey;				
				return this.homey.apps.subscribe();
			}.bind(this))
			.catch(function(err){
				this.homey = null;
			}.bind(this))
			.then(function(){
				this._homeyListeners.forEach(function(homeyListener){
					homeyListener.call( homeyListener, this.homey );
				}.bind(this));
			}.bind(this))
			
			.then(function(){				
				return this.homey.apps.getApp({ id: 'com.athom.homeyscript' })
			}.bind(this))
			.then(function(app){
    			if(!app.running) throw new Error('The HomeyScript app is not running. Please enable it.');
				if( this.app ) this.app.removeAllListeners();
				this.app = app;
			}.bind(this))
			.catch(function(err){
				this.app = null;
				
				if( err && err.message === 'not_found' || err.message === 'invalid_app' )
					return alert('HomeyScript app has not been installed on this Homey. Please install it from https://apps.athom.com/app/com.athom.homeyscript');
					
				return alert( err && err.message ? err.message : err );	
			}.bind(this))
			.then(function(){
				this._appListeners.forEach(function(appListener){
					appListener.call( appListener, this.app );
				}.bind(this));
			}.bind(this))
	}
}
