'use strict';

const Homey = require('homey');

module.exports = [

	{
		method: 'GET',
		path: '/script',
		owner: true,
		fn: (args, callback) => {
    		try {
			    callback(null, Homey.app.getScripts());
			} catch(err) {
    			callback(err);
			}
		}
	},

	{
		method: 'GET',
		path: '/script/:id',
		owner: true,
		fn: (args, callback) => {
    		try {
			    callback( null, Homey.app.getScript(args.params.id));
			} catch(err) {
    			callback(err);
			}
		}
	},

	{
		method: 'PUT',
		path: '/script/:id',
		owner: true,
		fn: args => {
			return Homey.app.updateScript(args.params.id, args.body);
		}
	},

	{
		method: 'DELETE',
		path: '/script/:id',
		owner: true,
		fn: (args, callback) => {
			return Homey.app.deleteScript(args.params.id);
		}
	},
	
	{
		method: 'POST',
		path: '/script/:id/run',
		owner: true,
		fn: async args => {
			let result = {
				success: true,
				returns: undefined,
			}
			
			try {
				result.returns = await Homey.app.runScript(args.params.id, args.body);				
			} catch( err ) {
				result.success = false;
				result.returns = err;
			}
			
			return result;
		}
	},
	
]