var	nodebb_admin = nodebb_admin || {};

(function() {
	var	plugins = {
			init: function() {
				var	pluginsList = $('.plugins'),
					pluginID, pluginTgl;

				pluginsList.on('click', 'button[data-action="toggleActive"]', function() {
					pluginID = $(this).parents('li').attr('data-plugin-id');
					socket.emit('api:admin.plugins.toggle', pluginID);
				});

				socket.on('api:admin.plugins.toggle', function(status) {
					pluginTgl = document.querySelector('.plugins li[data-plugin-id="' + status.id + '"] button');
					pluginTgl.innerHTML = '<i class="icon-off"></i> ' + (status.active ? 'Dea' : 'A') + 'ctivate';

					app.alert({
						alert_id: 'plugin_toggled_' + status.id,
						title: 'Plugin Enabled',
						message: 'You may need to restart NodeBB in order for these changes to be reflected.',
						type: 'notify',
						timeout: 5000
					})
				});
			}
		};

	jQuery(document).ready(function() {
		nodebb_admin.plugins = plugins;
		nodebb_admin.plugins.init();
	});
})();