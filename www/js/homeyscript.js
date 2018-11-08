var api;
var topbar;
var sidebar;
var editor;

window.addEventListener('load', function(){

	require.config({
		paths: {
			'vs': 'vendor/monaco-editor/min/vs'
		}
	});
	
	require([ 'vs/editor/editor.main' ], function() {
				
		api = new Api();
		editor = new Editor( api, topbar );
		topbar = new Topbar( api, editor );
		sidebar = new Sidebar( api, editor );
		
		api.init(function(err){
			if( err ) return alert( err && err.message ? err.message : err );
			
			topbar.init();
			editor.init();
			sidebar.init();
		});
		
	});
		
});

