"use strict";
/* globals define, socket, ajaxify, app, bootbox, utils, RELATIVE_PATH */

define('forum/groups/details', [
	'forum/groups/memberlist',
	'iconSelect',
	'components',
	'coverPhoto',
	'uploader',
	'vendor/colorpicker/colorpicker'
], function(memberList, iconSelect, components, coverPhoto, uploader) {

	var Details = {};
	var groupName;

	Details.init = function() {
		var detailsPage = components.get('groups/container');

		groupName = ajaxify.data.group.name;

		if (ajaxify.data.group.isOwner) {
			Details.prepareSettings();

			coverPhoto.init(components.get('groups/cover'),
				function(imageData, position, callback) {
					socket.emit('groups.cover.update', {
						groupName: groupName,
						imageData: imageData,
						position: position
					}, callback);
				},
				function() {
					uploader.show({
						title: '[[groups:upload-group-cover]]',
						route: config.relative_path + '/api/groups/uploadpicture',
						params: {groupName: groupName}
					}, function(imageUrlOnServer) {
						components.get('groups/cover').css('background-image', 'url(' + imageUrlOnServer + ')');
					});
				},
				removeCover
			);
		}

		memberList.init();

		handleMemberInvitations();

		components.get('groups/activity').find('.content img:not(.not-responsive)').addClass('img-responsive');

		detailsPage.on('click', '[data-action]', function() {
			var btnEl = $(this),
				userRow = btnEl.parents('[data-uid]'),
				ownerFlagEl = userRow.find('.member-name i'),
				isOwner = !ownerFlagEl.hasClass('invisible') ? true : false,
				uid = userRow.attr('data-uid'),
				action = btnEl.attr('data-action');

			switch(action) {
				case 'toggleOwnership':
					socket.emit('groups.' + (isOwner ? 'rescind' : 'grant'), {
						toUid: uid,
						groupName: groupName
					}, function(err) {
						if (!err) {
							ownerFlagEl.toggleClass('invisible');
						} else {
							app.alertError(err.message);
						}
					});
					break;

				case 'kick':
					socket.emit('groups.kick', {
						uid: uid,
						groupName: groupName
					}, function(err) {
						if (!err) {
							userRow.slideUp().remove();
						} else {
							app.alertError(err.message);
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
				case 'issueInvite':
				case 'rescindInvite':
				case 'acceptInvite':
				case 'rejectInvite':
				case 'acceptAll':
				case 'rejectAll':
					socket.emit('groups.' + action, {
						toUid: uid,
						groupName: groupName
					}, function(err) {
						if (!err) {
							ajaxify.refresh();
						} else {
							app.alertError(err.message);
						}
					});
					break;
			}
		});
	};

	Details.prepareSettings = function() {
		var settingsFormEl = components.get('groups/settings'),
			colorBtn = settingsFormEl.find('[data-action="color-select"]'),
			colorValueEl = settingsFormEl.find('[name="labelColor"]'),
			iconBtn = settingsFormEl.find('[data-action="icon-select"]'),
			previewEl = settingsFormEl.find('.label'),
			previewIcon = previewEl.find('i'),
			userTitleEl = settingsFormEl.find('[name="userTitle"]'),
			userTitleEnabledEl = settingsFormEl.find('[name="userTitleEnabled"]'),
			iconValueEl = settingsFormEl.find('[name="icon"]');

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
				iconValueEl.val(previewIcon.val());
			});
		});

		// If the user title changes, update that too
		userTitleEl.on('keyup', function() {
			var icon = previewIcon.detach();
			previewEl.text(' ' + (this.value || settingsFormEl.find('#name').val()));
			previewEl.prepend(icon);
		});

		// Disable user title customisation options if the the user title itself is disabled
		userTitleEnabledEl.on('change', function() {
			var customOpts = components.get('groups/userTitleOption');

			if (this.checked) {
				customOpts.removeAttr('disabled');
				previewEl.removeClass('hide');
			} else {
				customOpts.attr('disabled', 'disabled');
				previewEl.addClass('hide');
			}
		});
	};

	Details.update = function() {
		var settingsFormEl = components.get('groups/settings'),
			checkboxes = settingsFormEl.find('input[type="checkbox"][name]');

		if (settingsFormEl.length) {
			require(['vendor/jquery/serializeObject/jquery.ba-serializeobject.min'], function() {
				var settings = settingsFormEl.serializeObject();

				// Fix checkbox values
				checkboxes.each(function(idx, inputEl) {
					inputEl = $(inputEl);
					if (inputEl.length) {
						settings[inputEl.attr('name')] = inputEl.prop('checked');
					}
				});

				socket.emit('groups.update', {
					groupName: groupName,
					values: settings
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}

					if (settings.name) {
						var pathname = window.location.pathname;
						pathname = pathname.substr(1, pathname.lastIndexOf('/'));
						ajaxify.go(pathname + utils.slugify(settings.name));
					} else {
						ajaxify.refresh();
					}

					app.alertSuccess('[[groups:event.updated]]');
				});
			});
		}
	};

	Details.deleteGroup = function() {
		bootbox.confirm('Are you sure you want to delete the group: ' + utils.escapeHTML(groupName), function(confirm) {
			if (confirm) {
				bootbox.prompt('Please enter the name of this group in order to delete it:', function(response) {
					if (response === groupName) {
						socket.emit('groups.delete', {
							groupName: groupName
						}, function(err) {
							if (!err) {
								app.alertSuccess('[[groups:event.deleted, ' + utils.escapeHTML(groupName) + ']]');
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

	function handleMemberInvitations() {
		if (ajaxify.data.group.isOwner) {
			var searchInput = $('[component="groups/members/invite"]');
			require(['autocomplete'], function(autocomplete) {
				autocomplete.user(searchInput, function(e, selected) {
					socket.emit('groups.issueInvite', {
						toUid: selected.item.user.uid,
						groupName: ajaxify.data.group.name
					}, function(err) {
						if (!err) {
							ajaxify.refresh();
						} else {
							app.alertError(err.message);
						}
					});
				});
			});
		}
	}

	function removeCover() {
		socket.emit('groups.cover.remove', {
			groupName: ajaxify.data.group.name
		}, function(err) {
			if (!err) {
				ajaxify.refresh();
			} else {
				app.alertError(err.message);
			}
		});
	}

	return Details;
});