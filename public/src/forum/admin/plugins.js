define(function() {
	var Plugins = {
		init: function() {
			var pluginsList = $('.plugins'),
				numPlugins = pluginsList[0].querySelectorAll('li').length,
				pluginID, pluginTgl;

			if (numPlugins > 0) {
				pluginsList.on('click', 'button[data-action="toggleActive"]', function() {
					pluginID = $(this).parents('li').attr('data-plugin-id');
					socket.emit('admin.plugins.toggle', pluginID);
				});

				socket.on('admin.plugins.toggle', function(status) {
					pluginTgl = $('.plugins li[data-plugin-id="' + status.id + '"] button');
					pluginTgl.html('<i class="fa fa-power-off"></i> ' + (status.active ? 'Dea' : 'A') + 'ctivate');
					pluginTgl.toggleClass('btn-warning', status.active).toggleClass('btn-success', !status.active);

					app.alert({
						alert_id: 'plugin_toggled_' + status.id,
						title: 'Plugin ' + (status.active ? 'Enabled' : 'Disabled'),
						message: 'You may need to restart NodeBB in order for these changes to be reflected.',
						type: 'warning',
						timeout: 5000
					})
				});
			} else {
				pluginsList.append('<li><p><i>No plugins found.</i></p></li>');
			}
		}
	};

	return Plugins;
});