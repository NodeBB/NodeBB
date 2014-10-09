"use strict";
/* global define, app, socket */

define('admin/extend/plugins', function() {
	var Plugins = {
		init: function() {
			var pluginsList = $('.plugins'),
				numPlugins = pluginsList[0].querySelectorAll('li').length,
				pluginID;

			if (numPlugins > 0) {

				pluginsList.on('click', 'button[data-action="toggleActive"]', function() {
					pluginID = $(this).parents('li').attr('data-plugin-id');
					var btn = $(this);
					socket.emit('admin.plugins.toggleActive', pluginID, function(err, status) {
						btn.html('<i class="fa fa-power-off"></i> ' + (status.active ? 'Deactivate' : 'Activate'));
						btn.toggleClass('btn-warning', status.active).toggleClass('btn-success', !status.active);

						app.alert({
							alert_id: 'plugin_toggled',
							title: 'Plugin ' + (status.active ? 'Enabled' : 'Disabled'),
							message: status.active ? 'Please restart your NodeBB to fully activate this plugin' : 'Plugin successfully deactivated',
							type: status.active ? 'warning' : 'success',
							timeout: 5000,
							clickfn: function() {
								socket.emit('admin.restart');
							}
						});
					});
				});

				pluginsList.on('click', 'button[data-action="toggleInstall"]', function() {
					pluginID = $(this).parents('li').attr('data-plugin-id');

					var btn = $(this);
					var activateBtn = btn.siblings('[data-action="toggleActive"]');
					btn.html(btn.html() + 'ing')
						.attr('disabled', true)
						.find('i').attr('class', 'fa fa-refresh fa-spin');

					socket.emit('admin.plugins.toggleInstall', pluginID, function(err, status) {
						if (err) {
							return app.alertError(err.message);
						}

						if (status.installed) {
							btn.html('<i class="fa fa-trash-o"></i> Uninstall');
						} else {
							btn.html('<i class="fa fa-download"></i> Install');

						}
						activateBtn.toggleClass('hidden', !status.installed);

						btn.toggleClass('btn-danger', status.installed).toggleClass('btn-success', !status.installed)
							.attr('disabled', false);

						app.alert({
							alert_id: 'plugin_toggled',
							title: 'Plugin ' + (status.installed ? 'Installed' : 'Uninstalled'),
							message: status.installed ? 'Plugin successfully installed, please activate the plugin.' : 'The plugin has been successfully deactivated and uninstalled.',
							type: 'info',
							timeout: 5000
						});
					});
				});

				pluginsList.on('click', 'button[data-action="upgrade"]', function() {
					var btn = $(this);
					var parent = btn.parents('li');
					pluginID = parent.attr('data-plugin-id');

					btn.attr('disabled', true).find('i').attr('class', 'fa fa-refresh fa-spin');

					socket.emit('admin.plugins.upgrade', pluginID, function(err) {
						if (err) {
							return app.alertError(err.message);
						}
						parent.find('.fa-exclamation-triangle').remove();
						parent.find('.currentVersion').text(parent.find('.latestVersion').text());
						btn.remove();
					});
				});


				$('#plugin-search').on('input propertychange', function() {
					var term = $(this).val();
					$('.plugins li').each(function() {
						var pluginId = $(this).attr('data-plugin-id');
						$(this).toggleClass('hide', pluginId && pluginId.indexOf(term) === -1);
					});
				});

			} else {
				pluginsList.append('<li><p><i>No plugins found.</i></p></li>');
			}
		}
	};

	return Plugins;
});
