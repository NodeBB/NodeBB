"use strict";
/* globals define, socket, ajaxify, app, bootbox */

define('forum/groups/details', ['iconSelect', 'vendor/colorpicker/colorpicker'], function(iconSelect) {
	var Details = {};

	Details.init = function() {
		var detailsPage = $('.groups'),
			settingsFormEl = detailsPage.find('form');

		Details.prepareSettings();

		$('.latest-posts .content img').addClass('img-responsive');

		detailsPage.on('click', '[data-action]', function() {
			var btnEl = $(this),
				userRow = btnEl.parents('tr'),
				ownerFlagEl = userRow.find('.member-name i'),
				isOwner = !ownerFlagEl.hasClass('invisible') ? true : false,
				uid = userRow.attr('data-uid'),
				action = btnEl.attr('data-action');

			switch(action) {
				case 'toggleOwnership':
					socket.emit('groups.' + (isOwner ? 'rescind' : 'grant'), {
						toUid: uid,
						groupName: ajaxify.variables.get('group_name')
					}, function(err) {
						if (!err) {
							ownerFlagEl.toggleClass('invisible');
						} else {
							app.alertError(err);
						}
					});
					break;

				case 'update':
					Details.update();
					break;

				case 'delete':
					Details.deleteGroup();
					break;

				case 'join':	// intentional fall-throughs!
				case 'leave':
				case 'accept':
				case 'reject':
					socket.emit('groups.' + action, {
						toUid: uid,
						groupName: ajaxify.variables.get('group_name')
					}, function(err) {
						if (!err) {
							ajaxify.refresh();
						} else {
							app.alertError(err);
						}
					});
					break;
			}
		});
	};

	Details.prepareSettings = function() {
		var settingsFormEl = $('.groups form'),
			colorBtn = settingsFormEl.find('[data-action="color-select"]'),
			colorValueEl = settingsFormEl.find('[name="labelColor"]'),
			iconBtn = settingsFormEl.find('[data-action="icon-select"]'),
			previewEl = settingsFormEl.find('.label'),
			previewIcon = previewEl.find('i'),
			previewValueEl = settingsFormEl.find('[name="icon"]');

		if (settingsFormEl.length) {
			// Add color picker to settings form
			colorBtn.ColorPicker({
				color: colorValueEl.val() || '#000',
				onChange: function(hsb, hex) {
					colorValueEl.val('#' + hex);
					previewEl.css('background-color', '#' + hex);
				},
				onShow: function(colpkr) {
					$(colpkr).css('z-index', 1051);
				}
			});

			// Add icon selection interface
			iconBtn.on('click', function() {
				iconSelect.init(previewIcon, function() {
					previewValueEl.val(previewIcon.val());
				});
			});
		}
	};

	Details.update = function() {
		var settingsFormEl = $('.groups form');

		if (settingsFormEl.length) {
			require(['vendor/jquery/serializeObject/jquery.ba-serializeobject.min'], function() {
				var settings = settingsFormEl.serializeObject(),
					keys = Object.keys(settings),
					inputEl;

				// Fix checkbox values
				keys.forEach(function(key) {
					inputEl = settingsFormEl.find('input[type="checkbox"][name="' + key + '"]');
					if (inputEl.length) {
						settings[key] = settings[key] === 'on' ? true : false;
					}
				});

				socket.emit('groups.update', {
					groupName: ajaxify.variables.get('group_name'),
					values: settings
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}

					if (settings.name) {
						ajaxify.go('groups/' + encodeURIComponent(settings.name));
					} else {
						ajaxify.refresh();
					}

					app.alertSuccess('[[groups:event.updated');
				});
			});
		}
	};

	Details.deleteGroup = function() {
		bootbox.confirm('Are you sure you want to delete the group: ' + ajaxify.variables.get('group_name'), function(confirm) {
			if (confirm) {
				bootbox.prompt('Please enter the name of this group in order to delete it:', function(response) {
					if (response === ajaxify.variables.get('group_name')) {
						socket.emit('groups.delete', {
							groupName: ajaxify.variables.get('group_name')
						}, function(err) {
							if (!err) {
								app.alertSuccess('[[groups:event.deleted, ' + ajaxify.variables.get('group_name') + ']]');
								ajaxify.go('groups');
							} else {
								app.alertError(err.message);
							}
						});
					}
				});
			}
		});
	};

	return Details;
});