'use strict';

define('forum/groups/details', [
	'forum/groups/memberlist',
	'iconSelect',
	'components',
	'coverPhoto',
	'pictureCropper',
	'translator',
	'api',
	'slugify',
	'categorySelector',
], function (
	memberList,
	iconSelect,
	components,
	coverPhoto,
	pictureCropper,
	translator,
	api,
	slugify,
	categorySelector
) {
	var Details = {};
	var groupName;

	Details.init = function () {
		var detailsPage = components.get('groups/container');

		groupName = ajaxify.data.group.name;

		if (ajaxify.data.group.isOwner) {
			Details.prepareSettings();

			coverPhoto.init(
				components.get('groups/cover'),
				function (imageData, position, callback) {
					socket.emit('groups.cover.update', {
						groupName: groupName,
						imageData: imageData,
						position: position,
					}, callback);
				},
				function () {
					pictureCropper.show({
						title: '[[groups:upload-group-cover]]',
						socketMethod: 'groups.cover.update',
						aspectRatio: NaN,
						allowSkippingCrop: true,
						restrictImageDimension: false,
						paramName: 'groupName',
						paramValue: groupName,
					}, function (imageUrlOnServer) {
						imageUrlOnServer = (!imageUrlOnServer.startsWith('http') ? config.relative_path : '') + imageUrlOnServer + '?' + Date.now();
						components.get('groups/cover').css('background-image', 'url(' + imageUrlOnServer + ')');
					});
				},
				removeCover
			);
		}

		memberList.init();

		handleMemberInvitations();

		components.get('groups/activity').find('.content img:not(.not-responsive)').addClass('img-responsive');

		detailsPage.on('click', '[data-action]', function () {
			var btnEl = $(this);
			var userRow = btnEl.parents('[data-uid]');
			var ownerFlagEl = userRow.find('.member-name > i');
			var isOwner = !ownerFlagEl.hasClass('invisible');
			var uid = userRow.attr('data-uid');
			var action = btnEl.attr('data-action');

			switch (action) {
				case 'toggleOwnership':
					api[isOwner ? 'del' : 'put'](`/groups/${ajaxify.data.group.slug}/ownership/${uid}`, {}).then(() => {
						ownerFlagEl.toggleClass('invisible');
					}).catch(app.alertError);
					break;

				case 'kick':
					translator.translate('[[groups:details.kick_confirm]]', function (translated) {
						bootbox.confirm(translated, function (confirm) {
							if (!confirm) {
								return;
							}

							api.del(`/groups/${ajaxify.data.group.slug}/membership/${uid}`, undefined).then(() => userRow.slideUp().remove()).catch(app.alertError);
						});
					});
					break;

				case 'update':
					Details.update();
					break;

				case 'delete':
					Details.deleteGroup();
					break;

				case 'join':	// intentional fall-throughs!
					api.put('/groups/' + ajaxify.data.group.slug + '/membership/' + (uid || app.user.uid), undefined).then(() => ajaxify.refresh()).catch(app.alertError);
					break;

				case 'leave':
					api.del('/groups/' + ajaxify.data.group.slug + '/membership/' + (uid || app.user.uid), undefined).then(() => ajaxify.refresh()).catch(app.alertError);
					break;

				// TODO (14/10/2020): rewrite these to use api module and merge with above 2 case blocks
				case 'accept':	// intentional fall-throughs!
				case 'reject':
				case 'issueInvite':
				case 'rescindInvite':
				case 'acceptInvite':
				case 'rejectInvite':
				case 'acceptAll':
				case 'rejectAll':
					socket.emit('groups.' + action, {
						toUid: uid,
						groupName: groupName,
					}, function (err) {
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

	Details.prepareSettings = function () {
		var settingsFormEl = components.get('groups/settings');
		var labelColorValueEl = settingsFormEl.find('[name="labelColor"]');
		var textColorValueEl = settingsFormEl.find('[name="textColor"]');
		var iconBtn = settingsFormEl.find('[data-action="icon-select"]');
		var previewEl = settingsFormEl.find('.label');
		var previewElText = settingsFormEl.find('.label-text');
		var previewIcon = previewEl.find('i');
		var userTitleEl = settingsFormEl.find('[name="userTitle"]');
		var userTitleEnabledEl = settingsFormEl.find('[name="userTitleEnabled"]');
		var iconValueEl = settingsFormEl.find('[name="icon"]');

		labelColorValueEl.on('input', function () {
			previewEl.css('background-color', labelColorValueEl.val());
		});

		textColorValueEl.on('input', function () {
			previewEl.css('color', textColorValueEl.val());
		});

		// Add icon selection interface
		iconBtn.on('click', function () {
			iconSelect.init(previewIcon, function () {
				iconValueEl.val(previewIcon.val());
			});
		});

		// If the user title changes, update that too
		userTitleEl.on('keyup', function () {
			previewElText.translateText((this.value || settingsFormEl.find('#name').val()));
		});

		// Disable user title customisation options if the the user title itself is disabled
		userTitleEnabledEl.on('change', function () {
			var customOpts = components.get('groups/userTitleOption');

			if (this.checked) {
				customOpts.removeAttr('disabled');
				previewEl.removeClass('hide');
			} else {
				customOpts.attr('disabled', 'disabled');
				previewEl.addClass('hide');
			}
		});

		var cidSelector = categorySelector.init($('.member-post-cids-selector [component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				var cids = ($('#memberPostCids').val() || '').split(',').map(cid => parseInt(cid, 10));
				cids.push(selectedCategory.cid);
				cids = cids.filter((cid, index, array) => array.indexOf(cid) === index);
				$('#memberPostCids').val(cids.join(','));
				cidSelector.selectCategory(0);
			},
		});
	};

	Details.update = function () {
		var settingsFormEl = components.get('groups/settings');
		var checkboxes = settingsFormEl.find('input[type="checkbox"][name]');

		if (settingsFormEl.length) {
			var settings = settingsFormEl.serializeObject();

			// serializeObject doesnt return array for multi selects if only one item is selected
			if (!Array.isArray(settings.memberPostCids)) {
				settings.memberPostCids = $('#memberPostCids').val();
			}

			// Fix checkbox values
			checkboxes.each(function (idx, inputEl) {
				inputEl = $(inputEl);
				if (inputEl.length) {
					settings[inputEl.attr('name')] = inputEl.prop('checked');
				}
			});

			api.put(`/groups/${ajaxify.data.group.slug}`, settings).then(() => {
				if (settings.name) {
					var pathname = window.location.pathname;
					pathname = pathname.substr(1, pathname.lastIndexOf('/'));
					ajaxify.go(pathname + slugify(settings.name));
				} else {
					ajaxify.refresh();
				}

				app.alertSuccess('[[groups:event.updated]]');
			}).catch(app.alertError);
		}
	};

	Details.deleteGroup = function () {
		bootbox.confirm('Are you sure you want to delete the group: ' + utils.escapeHTML(groupName), function (confirm) {
			if (confirm) {
				bootbox.prompt('Please enter the name of this group in order to delete it:', function (response) {
					if (response === groupName) {
						api.del(`/groups/${ajaxify.data.group.slug}`, {}).then(() => {
							app.alertSuccess('[[groups:event.deleted, ' + utils.escapeHTML(groupName) + ']]');
							ajaxify.go('groups');
						}).catch(app.alertError);
					}
				});
			}
		});
	};

	function handleMemberInvitations() {
		if (!ajaxify.data.group.isOwner) {
			return;
		}

		var searchInput = $('[component="groups/members/invite"]');
		require(['autocomplete'], function (autocomplete) {
			autocomplete.user(searchInput, function (event, selected) {
				socket.emit('groups.issueInvite', {
					toUid: selected.item.user.uid,
					groupName: ajaxify.data.group.name,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					ajaxify.refresh();
				});
			});
		});

		$('[component="groups/members/bulk-invite-button"]').on('click', function () {
			var usernames = $('[component="groups/members/bulk-invite"]').val();
			if (!usernames) {
				return false;
			}
			socket.emit('groups.issueMassInvite', {
				usernames: usernames,
				groupName: ajaxify.data.group.name,
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				ajaxify.refresh();
			});
			return false;
		});
	}

	function removeCover() {
		translator.translate('[[groups:remove_group_cover_confirm]]', function (translated) {
			bootbox.confirm(translated, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('groups.cover.remove', {
					groupName: ajaxify.data.group.name,
				}, function (err) {
					if (!err) {
						ajaxify.refresh();
					} else {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	return Details;
});
