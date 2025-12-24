'use strict';

define('forum/groups/details', [
	'forum/groups/memberlist',
	'iconSelect',
	'components',
	'coverPhoto',
	'pictureCropper',
	'api',
	'slugify',
	'categorySelector',
	'bootbox',
	'alerts',
	'helpers',
], function (
	memberList,
	iconSelect,
	components,
	coverPhoto,
	pictureCropper,
	api,
	slugify,
	categorySelector,
	bootbox,
	alerts,
	helpers
) {
	const Details = {};
	let groupName;

	Details.init = function () {
		const detailsPage = components.get('groups/container');

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

		components.get('groups/activity').find('.content img:not(.not-responsive)').addClass('img-fluid');

		detailsPage.on('click', '[data-action]', function () {
			const btnEl = $(this);
			const userRow = btnEl.parents('[data-uid]');
			const ownerFlagEl = userRow.find('[component="groups/owner/icon"]');
			const isOwner = !!parseInt(userRow.attr('data-isowner'), 10);
			const uid = userRow.attr('data-uid');
			const action = btnEl.attr('data-action');

			switch (action) {
				case 'toggleOwnership':
					api[isOwner ? 'del' : 'put'](`/groups/${ajaxify.data.group.slug}/ownership/${uid}`, {}).then(() => {
						ownerFlagEl.toggleClass('invisible');
						userRow.attr('data-isowner', isOwner ? '0' : '1');
					}).catch(alerts.error);
					break;

				case 'kick':
					bootbox.confirm('[[groups:details.kick-confirm]]', function (confirm) {
						if (!confirm) {
							return;
						}

						api.del(`/groups/${ajaxify.data.group.slug}/membership/${uid}`, undefined).then(
							() => {
								userRow.remove();
								$('[component="group/member/count"]').text(
									helpers.humanReadableNumber(ajaxify.data.group.memberCount - 1)
								);
							}
						).catch(alerts.error);
					});
					break;

				case 'update':
					Details.update();
					break;

				case 'delete':
					Details.deleteGroup();
					break;

				case 'join':
					api.put('/groups/' + ajaxify.data.group.slug + '/membership/' + (uid || app.user.uid), undefined).then(
						() => ajaxify.refresh()
					).catch(alerts.error);
					break;

				case 'leave':
					api.del('/groups/' + ajaxify.data.group.slug + '/membership/' + (uid || app.user.uid), undefined).then(
						() => ajaxify.refresh()
					).catch(alerts.error);
					break;

				case 'accept':
					api.put(`/groups/${ajaxify.data.group.slug}/pending/${uid}`).then(
						() => {
							userRow.remove();
							memberList.refresh();
							updatePendingAlertVisibility();
						}
					).catch(alerts.error);
					break;

				case 'reject':
					api.del(`/groups/${ajaxify.data.group.slug}/pending/${uid}`).then(
						() => {
							userRow.remove();
							memberList.refresh();
							updatePendingAlertVisibility();
						}
					).catch(alerts.error);
					break;

				case 'acceptInvite':
					api.put(`/groups/${ajaxify.data.group.slug}/invites/${app.user.uid}`).then(() => {
						if (uid) {
							userRow.remove();
							memberList.refresh();
						} else {
							ajaxify.refresh();
						}
					}).catch(alerts.error);
					break;

				case 'rescindInvite': // falls through
				case 'rejectInvite':
					api.del(`/groups/${ajaxify.data.group.slug}/invites/${uid || app.user.uid}`).then(() => {
						if (uid) {
							userRow.remove();
							updateInviteAlertVisibility();
							memberList.refresh();
						} else {
							ajaxify.refresh();
						}
					}).catch(alerts.error);
					break;

				case 'acceptAll': // falls throughs
				case 'rejectAll': {
					const listEl = document.querySelector('[component="groups/pending"]');
					if (!listEl) {
						return;
					}

					const method = action === 'acceptAll' ? 'put' : 'del';
					let uids = Array.prototype.map.call(listEl.querySelectorAll('[data-uid]'), el => parseInt(el.getAttribute('data-uid'), 10));
					uids = uids.filter((uid, idx) => uids.indexOf(uid) === idx);

					Promise.all(uids.map(async uid => api[method](`/groups/${ajaxify.data.group.slug}/pending/${uid}`))).then(() => {
						ajaxify.refresh();
					}).catch(alerts.error);
					break;
				}
			}
		});
	};

	Details.prepareSettings = function () {
		const settingsFormEl = components.get('groups/settings');
		const labelColorValueEl = settingsFormEl.find('[name="labelColor"]');
		const textColorValueEl = settingsFormEl.find('[name="textColor"]');
		const iconBtn = settingsFormEl.find('[data-action="icon-select"]');
		const previewEl = settingsFormEl.find('.badge');
		const previewElText = settingsFormEl.find('.badge-text');
		const previewIcon = previewEl.find('i');
		const userTitleEl = settingsFormEl.find('[name="userTitle"]');
		const userTitleEnabledEl = settingsFormEl.find('[name="userTitleEnabled"]');
		const iconValueEl = settingsFormEl.find('[name="icon"]');

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
			previewElText.translateText((userTitleEl.val()));
		});

		// Disable user title customisation options if the the user title itself is disabled
		userTitleEnabledEl.on('change', function () {
			const customOpts = components.get('groups/userTitleOption');

			if (this.checked) {
				customOpts.removeAttr('disabled');
				previewEl.removeClass('hide');
			} else {
				customOpts.attr('disabled', 'disabled');
				previewEl.addClass('hide');
			}
		});

		const cidSelector = categorySelector.init($('.member-post-cids-selector [component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				let cids = ($('#memberPostCids').val() || '').split(',').map(cid => parseInt(cid, 10));
				cids.push(selectedCategory.cid);
				cids = cids.filter((cid, index, array) => array.indexOf(cid) === index);
				$('#memberPostCids').val(cids.join(','));
				cidSelector.selectCategory(0);
			},
		});
	};

	Details.update = function () {
		const settingsFormEl = components.get('groups/settings');
		const checkboxes = settingsFormEl.find('input[type="checkbox"][name]');

		if (settingsFormEl.length) {
			const settings = settingsFormEl.serializeObject();

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
				if (settings.name !== ajaxify.data.group.name) {
					let pathname = window.location.pathname;
					pathname = pathname.slice(1, pathname.lastIndexOf('/') + 1);
					ajaxify.go(pathname + slugify(settings.name));
				}

				alerts.success('[[groups:event.updated]]');
			}).catch(alerts.error);
		}
	};

	Details.deleteGroup = function () {
		bootbox.confirm('Are you sure you want to delete the group: ' + utils.escapeHTML(groupName), function (confirm) {
			if (confirm) {
				bootbox.prompt('Please enter the name of this group in order to delete it:', function (response) {
					if (response === groupName) {
						api.del(`/groups/${ajaxify.data.group.slug}`, {}).then(() => {
							alerts.success('[[groups:event.deleted, ' + utils.escapeHTML(groupName) + ']]');
							ajaxify.go('groups');
						}).catch(alerts.error);
					}
				});
			}
		});
	};

	function updatePendingAlertVisibility() {
		$('[component="groups/pending/alert"]').toggleClass(
			'hidden',
			$('[component="groups/pending"] tbody tr').length > 0
		);
	}

	function updateInviteAlertVisibility() {
		$('[component="groups/invited/alert"]').toggleClass(
			'hidden',
			$('[component="groups/invited"] tbody tr').length > 0
		);
	}

	function handleMemberInvitations() {
		if (!ajaxify.data.group.isOwner) {
			return;
		}
		async function updateList() {
			const data = await api.get(`/api/groups/${ajaxify.data.group.slug}`);
			const html = await app.parseAndTranslate('groups/details', 'group.invited', { group: data.group });
			$('[component="groups/invited"] tbody').html(html);
			updateInviteAlertVisibility();
			memberList.refresh();
		}
		const searchInput = $('[component="groups/members/invite"]');
		require(['autocomplete'], function (autocomplete) {
			autocomplete.user(searchInput, function (event, selected) {
				api.post(`/groups/${ajaxify.data.group.slug}/invites/${selected.item.user.uid}`).then(() => updateList()).catch(alerts.error);
			});
		});

		$('[component="groups/members/bulk-invite-button"]').on('click', async () => {
			let usernames = $('[component="groups/members/bulk-invite"]').val();
			if (!usernames) {
				return false;
			}

			// Filter out bad usernames
			usernames = usernames.split(',').map(username => slugify(username));
			usernames = await Promise.all(usernames.map(slug => api.head(`/users/bySlug/${slug}`).then(() => slug).catch(() => false)));
			usernames = usernames.filter(Boolean);

			const uids = await Promise.all(usernames.map(slug => api.get(`/users/bySlug/${slug}`).then(({ uid }) => uid)));

			await Promise.all(uids.map(async uid => api.post(`/groups/${ajaxify.data.group.slug}/invites/${uid}`))).then(() => {
				updateList();
			}).catch(alerts.error);
		});
	}

	function removeCover() {
		bootbox.confirm('[[groups:remove-group-cover-confirm]]', function (confirm) {
			if (!confirm) {
				return;
			}

			socket.emit('groups.cover.remove', {
				groupName: ajaxify.data.group.name,
			}, function (err) {
				if (!err) {
					ajaxify.refresh();
				} else {
					alerts.error(err);
				}
			});
		});
	}

	return Details;
});
