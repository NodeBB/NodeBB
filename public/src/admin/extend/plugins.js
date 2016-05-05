"use strict";
/* global define, app, socket, bootbox */

define('admin/extend/plugins', function() {
	var Plugins = {};
	Plugins.init = function() {
		var pluginsList = $('.plugins'),
			numPlugins = pluginsList[0].querySelectorAll('li').length,
			pluginID;

		if (!numPlugins) {
			pluginsList.append('<li><p><i>No plugins found.</i></p></li>');
			return;
		}

		$('#plugin-search').val('');

		pluginsList.on('click', 'button[data-action="toggleActive"]', function() {
			var pluginEl = $(this).parents('li');
			pluginID = pluginEl.attr('data-plugin-id');
			var btn = $('#' + pluginID + ' [data-action="toggleActive"]');
			socket.emit('admin.plugins.toggleActive', pluginID, function(err, status) {
				btn.html('<i class="fa fa-power-off"></i> ' + (status.active ? 'Deactivate' : 'Activate'));
				btn.toggleClass('btn-warning', status.active).toggleClass('btn-success', !status.active);

				//clone it to active plugins tab
				if (status.active && !$('#active #' + pluginID).length) {
					$('#active ul').prepend(pluginEl.clone(true));
				}

				app.alert({
					alert_id: 'plugin_toggled',
					title: 'Plugin ' + (status.active ? 'Enabled' : 'Disabled'),
					message: status.active ? 'Please reload your NodeBB to fully activate this plugin' : 'Plugin successfully deactivated',
					type: status.active ? 'warning' : 'success',
					timeout: 5000,
					clickfn: function() {
						require(['admin/modules/instance'], function(instance) {
							instance.reload();
						});
					}
				});
			});
		});

		pluginsList.on('click', 'button[data-action="toggleInstall"]', function() {
			var btn = $(this);
			btn.attr('disabled', true);
			pluginID = $(this).parents('li').attr('data-plugin-id');

			if ($(this).attr('data-installed') === '1') {
				return Plugins.toggleInstall(pluginID, $(this).parents('li').attr('data-version'));
			}

			Plugins.suggest(pluginID, function(err, payload) {
				if (err) {
					bootbox.confirm('<p>NodeBB could not reach the package manager, proceed with installation of latest version?</p><div class="alert alert-danger"><strong>Server returned (' + err.status + ')</strong>: ' + err.responseText + '</div>', function(confirm) {
						if (confirm) {
							Plugins.toggleInstall(pluginID, 'latest');
						} else {
							btn.removeAttr('disabled');
						}
					});
					return;
				}

				require(['semver'], function(semver) {
					if (payload.version !== 'latest') {
						Plugins.toggleInstall(pluginID, payload.version);
					} else if (payload.version === 'latest') {
						confirmInstall(pluginID, function(confirm) {
							if (confirm) {
								Plugins.toggleInstall(pluginID, 'latest');
							} else {
								btn.removeAttr('disabled');
							}
						});
					} else {
						btn.removeAttr('disabled');
					}
				});
			});
		});

		pluginsList.on('click', 'button[data-action="upgrade"]', function() {
			var btn = $(this);
			var parent = btn.parents('li');
			pluginID = parent.attr('data-plugin-id');

			Plugins.suggest(pluginID, function(err, payload) {
				if (err) {
					return bootbox.alert('<p>NodeBB could not reach the package manager, an upgrade is not suggested at this time.</p>');
				}

				require(['semver'], function(semver) {
					if (payload.version !== 'latest' && semver.gt(payload.version, parent.find('.currentVersion').text())) {
						upgrade(pluginID, btn, payload.version);
					} else if (payload.version === 'latest') {
						confirmInstall(pluginID, function() {
							upgrade(pluginID, btn, payload.version);
						});
					} else {
						bootbox.alert('<p>Your version of NodeBB (v' + app.config.version + ') is only cleared to upgrade to v' + payload.version + ' of this plugin. Please update your NodeBB if you wish to install a newer version of this plugin.');
					}
				});
			});
		});

		$('#plugin-search').on('input propertychange', function() {
			var term = $(this).val();
			$('.plugins li').each(function() {
				var pluginId = $(this).attr('data-plugin-id');
				$(this).toggleClass('hide', pluginId && pluginId.indexOf(term) === -1);
			});
		});

		$('#plugin-order').on('click', function() {
			$('#order-active-plugins-modal').modal('show');
			socket.emit('admin.plugins.getActive', function(err, activePlugins) {
				if (err) {
					return app.alertError(err);
				}
				var html = '';
				activePlugins.forEach(function(plugin) {
					html += '<li class="">' + plugin + '</li>';
				});
				if (!activePlugins.length) {
					html = 'No Active Plugins';
				}
				$('#order-active-plugins-modal .plugin-list').html(html).sortable();
			});
		});

		$('#save-plugin-order').on('click', function() {
			var plugins = $('#order-active-plugins-modal .plugin-list').children();
			var data = [];
			plugins.each(function(index, el) {
				data.push({name: $(el).text(), order: index});
			});

			socket.emit('admin.plugins.orderActivePlugins', data, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('#order-active-plugins-modal').modal('hide');
			});
		});

		populateUpgradeablePlugins();
		populateActivePlugins();
	};

	function confirmInstall(pluginID, callback) {
		bootbox.confirm(
			'<div class="alert alert-warning"><p><strong>No Compatibility Infomation Found</strong></p><p>This plugin did not specify a specific version for installation given your NodeBB version. Full compatibility cannot be guaranteed, and may cause your NodeBB to no longer start properly.</p></div>' +
			'<p>In the event that NodeBB cannot boot properly:</p>' +
			'<pre><code>$ ./nodebb reset plugin="' + pluginID + '"</code></pre>' +
			'<p>Continue installation of latest version of this plugin?</p>', function(confirm) {
				callback(confirm);
		});
	}

	function upgrade(pluginID, btn, version) {
		btn.attr('disabled', true).find('i').attr('class', 'fa fa-refresh fa-spin');
		socket.emit('admin.plugins.upgrade', {
			id: pluginID,
			version: version
		}, function(err, isActive) {
			if (err) {
				return app.alertError(err.message);
			}
			var parent = btn.parents('li');
			parent.find('.fa-exclamation-triangle').remove();
			parent.find('.currentVersion').text(version);
			btn.remove();
			if (isActive) {
				app.alert({
					alert_id: 'plugin_upgraded',
					title: 'Plugin Upgraded',
					message: 'Please reload your NodeBB to fully upgrade this plugin',
					type: 'warning',
					timeout: 5000,
					clickfn: function() {
						require(['admin/modules/instance'], function(instance) {
							instance.reload();
						});
					}
				});
			}
		});
	}

	Plugins.toggleInstall = function(pluginID, version, callback) {
		var btn = $('li[data-plugin-id="' + pluginID + '"] button[data-action="toggleInstall"]');
		var activateBtn = btn.siblings('[data-action="toggleActive"]');
		btn.find('i').attr('class', 'fa fa-refresh fa-spin');

		socket.emit('admin.plugins.toggleInstall', {
			id: pluginID,
			version: version
		}, function(err, pluginData) {
			if (err) {
				btn.removeAttr('disabled');
				return app.alertError(err.message);
			}

			ajaxify.refresh();

			app.alert({
				alert_id: 'plugin_toggled',
				title: 'Plugin ' + (pluginData.installed ? 'Installed' : 'Uninstalled'),
				message: pluginData.installed ? 'Plugin successfully installed, please activate the plugin.' : 'The plugin has been successfully deactivated and uninstalled.',
				type: 'info',
				timeout: 5000
			});

			if (typeof callback === 'function') {
				callback.apply(this, arguments);
			}
		});
	};

	Plugins.suggest = function(pluginId, callback) {
		var nbbVersion = app.config.version.match(/^\d\.\d\.\d/);
		$.ajax((app.config.registry || 'https://packages.nodebb.org') + '/api/v1/suggest', {
			type: 'GET',
			data: {
				package: pluginId,
				version: nbbVersion[0]
			},
			dataType: 'json'
		}).done(function(payload) {
			callback(undefined, payload);
		}).fail(callback);
	};

	function populateUpgradeablePlugins() {
		$('#installed ul li').each(function() {
			if ($(this).children('[data-action="upgrade"]').length) {
				$('#upgrade ul').append($(this).clone(true));
			}
		});
	}

	function populateActivePlugins() {
		$('#installed ul li').each(function() {
			if ($(this).hasClass('active')) {
				$('#active ul').append($(this).clone(true));
			}
		});
	}

	return Plugins;
});
