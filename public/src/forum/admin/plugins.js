var	nodebb_admin = nodebb_admin || {};

(function() {
	var	plugins = {
			init: function() {
				// socket.on('api:admin.plugins.getInstalled', function(pluginsArr) {
				// 	var	pluginsFrag = document.createDocumentFragment(),
				// 		liEl = document.createElement('li');
				// 	for(var x=0,numPlugins=pluginsArr.length;x<numPlugins;x++) {
				// 		liEl.setAttribute('data-plugin-id', pluginsArr[x].id);
						
				// 	}
				// });
			}
		};

	jQuery(document).ready(function() {
		nodebb_admin.plugins = plugins;
		nodebb_admin.plugins.init();
		// socket.emit('api:admin.plugins.getInstalled');
	});
})();