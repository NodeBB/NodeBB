'use strict';


define('admin/extend/plugins', [
	'translator',
	'benchpress',
	'bootbox',
	'alerts',
	'jquery-ui/widgets/sortable',
], function (translator, Benchpress, bootbox, alerts) {
	const Plugins = {};
	Plugins.init = function () {
		const pluginsList = $('.plugins');
		let pluginID;

		if (window.location.hash) {
			$(`.nav-pills button[data-bs-target="${window.location.hash}"]`).trigger('click');
		}

		const searchInputEl = $('#plugin-search');

		pluginsList.on('click', 'button[data-action="toggleActive"]', function () {
			const pluginEl = $(this).parents('li');
			pluginID = pluginEl.attr('data-plugin-id');
			const btn = $(this);

			const pluginData = ajaxify.data.installed.find(plugin => plugin.id === pluginID);
			if (!pluginData) {
				return;
			}

			function toggleActivate() {
				socket.emit('admin.plugins.toggleActive', pluginID, function (err, status) {
					if (err) {
						return alerts.error(err);
					}
					btn.siblings('[data-action="toggleActive"]').removeClass('hidden');
					btn.addClass('hidden');

					// clone it to active plugins tab
					if (status.active && !$('#active [id="' + pluginID + '"]').length) {
						$('#active ul').prepend(pluginEl.clone(true));
					}

					// Toggle active state in template data
					pluginData.active = !pluginData.active;

					alerts.alert({
						alert_id: 'plugin_toggled',
						title: '[[admin/extend/plugins:alert.' + (status.active ? 'enabled' : 'disabled') + ']]',
						message: '[[admin/extend/plugins:alert.' + (status.active ? 'activate-success' : 'deactivate-success') + ']]',
						type: status.active ? 'warning' : 'success',
						timeout: 5000,
						clickfn: function () {
							require(['admin/modules/instance'], function (instance) {
								instance.rebuildAndRestart();
							});
						},
					});
				});
			}

			if (pluginData.license && pluginData.active !== true) {
				Benchpress.render('admin/partials/plugins/license', pluginData).then(function (html) {
					bootbox.dialog({
						title: '[[admin/extend/plugins:license.title]]',
						message: html,
						size: 'large',
						buttons: {
							cancel: {
								label: '[[modules:bootbox.cancel]]',
								className: 'btn-link',
							},
							save: {
								label: '[[modules:bootbox.confirm]]',
								className: 'btn-primary',
								callback: toggleActivate,
							},
						},
						onShown: function () {
							const saveEl = this.querySelector('button.btn-primary');
							if (saveEl) {
								saveEl.focus();
							}
						},
					});
				});
			} else {
				toggleActivate(pluginID);
			}
		});

		pluginsList.on('click', 'button[data-action="toggleInstall"]', function () {
			const btn = $(this);
			btn.attr('disabled', true);
			pluginID = $(this).parents('li').attr('data-plugin-id');

			if ($(this).attr('data-installed') === '1') {
				return Plugins.toggleInstall(pluginID, $(this).parents('li').attr('data-version'));
			}

			Plugins.suggest(pluginID, function (err, payload) {
				if (err) {
					bootbox.confirm(translator.compile('admin/extend/plugins:alert.suggest-error', err.status, err.responseText), function (confirm) {
						if (confirm) {
							Plugins.toggleInstall(pluginID, 'latest');
						} else {
							btn.removeAttr('disabled');
						}
					});
					return;
				}

				if (payload.version !== 'latest') {
					Plugins.toggleInstall(pluginID, payload.version);
				} else if (payload.version === 'latest') {
					confirmInstall(pluginID, function (confirm) {
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

		pluginsList.on('click', 'button[data-action="upgrade"]', function () {
			const btn = $(this);
			const parent = btn.parents('li');
			pluginID = parent.attr('data-plugin-id');

			Plugins.suggest(pluginID, function (err, payload) {
				if (err) {
					return bootbox.alert('[[admin/extend/plugins:alert.package-manager-unreachable]]');
				}

				require(['compare-versions'], function (compareVersions) {
					const currentVersion = parent.find('.currentVersion').text();
					if (payload.version && payload.version !== 'latest' && compareVersions.compare(payload.version, currentVersion, '>')) {
						upgrade(pluginID, btn, payload.version);
					} else if (payload.version === 'latest' || payload.version === null) {
						confirmInstall(pluginID, function (confirm) {
							if (confirm) {
								upgrade(pluginID, btn, payload.version);
							}
						});
					} else {
						bootbox.alert(translator.compile('admin/extend/plugins:alert.incompatible', app.config.version, payload.version));
					}
				});
			});
		});

		$(searchInputEl).on('input propertychange', utils.debounce(function () {
			const term = $(this).val();
			$('.plugins li').each(function () {
				const pluginId = $(this).attr('data-plugin-id');
				$(this).toggleClass('hide', pluginId && !pluginId.includes(term));
			});

			const activeTab = $('#plugin-tabs [data-bs-target].active').attr('data-bs-target');
			if (activeTab === '#download') {
				searchAllPlugins(term);
			}

			const tabEls = document.querySelectorAll('.plugins .tab-pane');
			tabEls.forEach((tabEl) => {
				const remaining = tabEl.querySelectorAll('li:not(.hide)').length;
				const noticeEl = tabEl.querySelector('.no-plugins');
				if (noticeEl) {
					noticeEl.classList.toggle('hide', remaining !== 0);
				}
			});
		}, 250));

		$('#plugin-submit-usage').on('click', function () {
			socket.emit('admin.config.setMultiple', {
				submitPluginUsage: $(this).prop('checked') ? '1' : '0',
			}, function (err) {
				if (err) {
					return alerts.error(err);
				}
			});
		});

		$('#plugin-order').on('click', function () {
			$('#order-active-plugins-modal').modal('show');
			socket.emit('admin.plugins.getActive', function (err, activePlugins) {
				if (err) {
					return alerts.error(err);
				}
				let html = '';
				activePlugins.forEach(function (plugin) {
					html += `
						<li class="d-flex justify-content-between gap-1 pointer border-bottom pb-2" data-plugin="${plugin}">
							${plugin}
							<div class="d-flex gap-1">
								<div class="btn btn-ghost btn-sm move-up">
									<i class="fa fa-chevron-up"></i>
								</div>
								<div class="btn btn-ghost btn-sm move-down">
									<i class="fa fa-chevron-down"></i>
								</div>
							</div>
						</li>
					`;
				});
				if (!activePlugins.length) {
					translator.translate('[[admin/extend/plugins:none-active]]', function (text) {
						$('#order-active-plugins-modal .plugin-list').html(text).sortable();
					});
					return;
				}
				const list = $('#order-active-plugins-modal .plugin-list');
				list.html(html).sortable();

				list.find('.move-up').on('click', function () {
					const item = $(this).parents('li');
					item.prev().before(item);
				});

				list.find('.move-down').on('click', function () {
					const item = $(this).parents('li');
					item.next().after(item);
				});
			});
		});

		$('#save-plugin-order').on('click', function () {
			const plugins = $('#order-active-plugins-modal .plugin-list').children();
			const data = [];
			plugins.each(function (index, el) {
				data.push({ name: $(el).attr('data-plugin'), order: index });
			});

			socket.emit('admin.plugins.orderActivePlugins', data, function (err) {
				if (err) {
					return alerts.error(err);
				}
				$('#order-active-plugins-modal').modal('hide');

				alerts.alert({
					alert_id: 'plugin_reordered',
					title: '[[admin/extend/plugins:alert.reorder]]',
					message: '[[admin/extend/plugins:alert.reorder-success]]',
					type: 'success',
					timeout: 5000,
					clickfn: function () {
						require(['admin/modules/instance'], function (instance) {
							instance.rebuildAndRestart();
						});
					},
				});
			});
		});
	};

	async function searchAllPlugins(term) {
		const { download, incompatible } = ajaxify.data;
		const all = term ? download.concat(incompatible) : download;
		const found = all.filter(p => p && p.name.includes(term)).slice(0, 100);
		const html = await app.parseAndTranslate('admin/extend/plugins', 'download', { download: found });
		$('#download ul').html(html);
	}

	function confirmInstall(pluginID, callback) {
		bootbox.confirm(translator.compile('admin/extend/plugins:alert.possibly-incompatible', pluginID), function (confirm) {
			callback(confirm);
		});
	}

	function upgrade(pluginID, btn, version) {
		btn.attr('disabled', true).find('i').attr('class', 'fa fa-refresh fa-spin');
		socket.emit('admin.plugins.upgrade', {
			id: pluginID,
			version: version,
		}, function (err, isActive) {
			if (err) {
				return alerts.error(err);
			}
			const parent = btn.parents('li');
			parent.find('.fa-exclamation-triangle').remove();
			parent.find('.currentVersion').text(version);
			btn.remove();
			if (isActive) {
				alerts.alert({
					alert_id: 'plugin_upgraded',
					title: '[[admin/extend/plugins:alert.upgraded]]',
					message: '[[admin/extend/plugins:alert.upgrade-success]]',
					type: 'warning',
					timeout: 5000,
					clickfn: function () {
						require(['admin/modules/instance'], function (instance) {
							instance.rebuildAndRestart();
						});
					},
				});
			}
		});
	}

	Plugins.toggleInstall = function (pluginID, version, callback) {
		const btn = $('li[data-plugin-id="' + pluginID + '"] button[data-action="toggleInstall"]');
		btn.find('i').attr('class', 'fa fa-refresh fa-spin');

		socket.emit('admin.plugins.toggleInstall', {
			id: pluginID,
			version: version,
		}, function (err, pluginData) {
			if (err) {
				btn.removeAttr('disabled');
				return alerts.error(err);
			}
			function removeAndUpdateBadge(section) {
				$(`${section} [data-plugin-id="${pluginID}"]`).remove();
				const count = $(`${section} [data-plugin-id]`).length;
				$(`[data-bs-target="${section}"] .badge`).text(count);
			}
			if (!pluginData.installed) {
				['#installed', '#active', '#deactive', '#upgrade'].forEach(removeAndUpdateBadge);
			} else {
				ajaxify.refresh();
			}

			alerts.alert({
				alert_id: 'plugin_toggled',
				title: '[[admin/extend/plugins:alert.' + (pluginData.installed ? 'installed' : 'uninstalled') + ']]',
				message: '[[admin/extend/plugins:alert.' + (pluginData.installed ? 'install-success' : 'uninstall-success') + ']]',
				type: 'info',
				timeout: 5000,
			});

			if (typeof callback === 'function') {
				callback.apply(this, arguments);
			}
		});
	};

	Plugins.suggest = function (pluginId, callback) {
		const nbbVersion = app.config.version.match(/^\d+\.\d+\.\d+/);
		$.ajax((app.config.registry || 'https://packages.nodebb.org') + '/api/v1/suggest', {
			type: 'GET',
			data: {
				package: pluginId,
				version: nbbVersion[0],
			},
			dataType: 'json',
		}).done(function (payload) {
			callback(undefined, payload);
		}).fail(callback);
	};

	return Plugins;
});
