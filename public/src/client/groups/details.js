"use strict";
/* globals define, socket, ajaxify, app, bootbox, RELATIVE_PATH, utils */

define('forum/groups/details', ['iconSelect', 'vendor/colorpicker/colorpicker', 'vendor/jquery/draggable-background/backgroundDraggable'], function(iconSelect) {
	var Details = {
			cover: {}
		};

	Details.init = function() {
		var detailsPage = $('.groups'),
			settingsFormEl = detailsPage.find('form');

		if (ajaxify.variables.get('is_owner') === 'true') {
			Details.prepareSettings();
			Details.initialiseCover();
		}

		$('.latest-posts .content img').addClass('img-responsive');

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
						groupName: ajaxify.variables.get('group_name')
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
						groupName: ajaxify.variables.get('group_name')
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
				case 'acceptInvite':
				case 'rejectInvite':
					socket.emit('groups.' + action, {
						toUid: uid,
						groupName: ajaxify.variables.get('group_name')
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
		var settingsFormEl = $('.groups form'),
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
			var customOpts = $('.user-title-option input, .user-title-option button');

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
		var settingsFormEl = $('.groups form'),
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
					groupName: ajaxify.variables.get('group_name'),
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
		bootbox.confirm('Are you sure you want to delete the group: ' + utils.escapeHTML(ajaxify.variables.get('group_name')), function(confirm) {
			if (confirm) {
				bootbox.prompt('Please enter the name of this group in order to delete it:', function(response) {
					if (response === ajaxify.variables.get('group_name')) {
						socket.emit('groups.delete', {
							groupName: ajaxify.variables.get('group_name')
						}, function(err) {
							if (!err) {
								app.alertSuccess('[[groups:event.deleted, ' + utils.escapeHTML(ajaxify.variables.get('group_name')) + ']]');
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

	// Cover Photo Handling Code

	Details.initialiseCover = function() {
		var coverEl = $('.group-cover');
		coverEl.find('.change').on('click', function() {
			coverEl.toggleClass('active', 1);
			coverEl.backgroundDraggable({
				axis: 'y'
			});
			coverEl.on('dragover', Details.cover.onDragOver);
			coverEl.on('drop', Details.cover.onDrop);
		});

		coverEl.find('.save').on('click', Details.cover.save);
		coverEl.addClass('initialised');
	};

	Details.cover.load = function() {
		socket.emit('groups.cover.get', {
			groupName: ajaxify.variables.get('group_name')
		}, function(err, data) {
			if (!err) {
				var coverEl = $('.group-cover');
				if (data['cover:url']) {
					coverEl.css('background-image', 'url(' + data['cover:url'] + ')');
				}

				if (data['cover:position']) {
					coverEl.css('background-position', data['cover:position']);
				}

				delete Details.cover.newCover;
			} else {
				app.alertError(err.message);
			}
		});
	};

	Details.cover.onDragOver = function(e) {
		e.stopPropagation();
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'copy';
	};

	Details.cover.onDrop = function(e) {
		var coverEl = $('.group-cover');
		e.stopPropagation();
		e.preventDefault();

		var files = e.originalEvent.dataTransfer.files,
		reader = new FileReader();

		if (files.length && files[0].type.match('image.*')) {
			reader.onload = function(e) {
				coverEl.css('background-image', 'url(' + e.target.result + ')');
				coverEl.backgroundDraggable();
				Details.cover.newCover = e.target.result;
			};

			reader.readAsDataURL(files[0]);
		}
	};

	Details.cover.save = function() {
		var coverEl = $('.group-cover');

		coverEl.addClass('saving');

		socket.emit('groups.cover.update', {
			groupName: ajaxify.variables.get('group_name'),
			imageData: Details.cover.newCover || undefined,
			position: $('.group-cover').css('background-position')
		}, function(err) {
			if (!err) {
				coverEl.toggleClass('active', 0);
				coverEl.backgroundDraggable('disable');
				coverEl.off('dragover', Details.cover.onDragOver);
				coverEl.off('drop', Details.cover.onDrop);
				Details.cover.load();
			} else {
				app.alertError(err.message);
			}

			coverEl.removeClass('saving');
		});
	};

	return Details;
});