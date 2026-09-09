'use strict';

define('forum/groups/details', [
	'bootstrap',
	'forum/groups/memberlist',
	'iconSelect',
	'components',
	'coverPhoto',
	'pictureCropper',
	'api',
	'slugify',
	'categorySelector',
	'modals',
	'alerts',
	'helpers',
	'translator',
	'autocomplete',
	'benchpressjs',
], function (
	bootstrap,
	memberList,
	iconSelect,
	components,
	coverPhoto,
	pictureCropper,
	api,
	slugify,
	categorySelector,
	modals,
	alerts,
	helpers,
	tx,
	autocomplete,
	Benchpress,
) {
	const Details = {};
	let groupName;

	Details.init = function () {
		const detailsPage = components.get('groups/container');

		groupName = ajaxify.data.group.name;

		handleTabNavigation(detailsPage);

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

		$('[component="groups/invite-members"]').on('click', function () {
			const isAdminGroup = ajaxify.data.group.slug === 'administrators';
			if (isAdminGroup) {
				api.post('/users/reauth/verify').then(() => {
					handleMemberInvitations();
				}).catch(alerts.error);
			} else {
				handleMemberInvitations();
			}
		});


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
					memberList.toggleOwnership(ajaxify.data.group.slug, uid, isOwner).then(() => {
						ownerFlagEl.toggleClass('d-none');
						userRow.attr('data-isowner', isOwner ? '0' : '1');
					}).catch(alerts.error);
					break;

				case 'kick':
					memberList.kickMember(ajaxify.data.group.slug, uid).then(() => {
						userRow.remove();
						$('[component="group/member/count"]').text(
							helpers.humanReadableNumber(ajaxify.data.group.memberCount - 1)
						);
					}).catch(alerts.error);
					break;

				case 'update':
					Details.update();
					break;

				case 'delete':
					Details.deleteGroup();
					break;

				case 'join':
					api.put(`/groups/${ajaxify.data.group.slug}/membership/${encodeURIComponent(uid || app.user.uid)}`, undefined).then(
						() => ajaxify.refresh()
					).catch(alerts.error);
					break;

				case 'leave':
					api.del(`/groups/${ajaxify.data.group.slug}/membership/${encodeURIComponent(uid || app.user.uid)}`, undefined).then(
						() => ajaxify.refresh()
					).catch(alerts.error);
					break;

				case 'accept':
					api.put(`/groups/${ajaxify.data.group.slug}/pending/${encodeURIComponent(uid)}`).then(
						() => {
							userRow.remove();
							memberList.refresh();
							updatePendingAlertVisibility();
						}
					).catch(alerts.error);
					break;

				case 'reject':
					api.del(`/groups/${ajaxify.data.group.slug}/pending/${encodeURIComponent(uid)}`).then(
						() => {
							userRow.remove();
							memberList.refresh();
							updatePendingAlertVisibility();
						}
					).catch(alerts.error);
					break;

				case 'acceptInvite':
					api.put(`/groups/${ajaxify.data.group.slug}/invites/${encodeURIComponent(app.user.uid)}`).then(() => {
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
					api.del(`/groups/${ajaxify.data.group.slug}/invites/${encodeURIComponent(uid || app.user.uid)}`).then(() => {
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

					Promise.all(uids.map(async uid => api[method](`/groups/${ajaxify.data.group.slug}/pending/${encodeURIComponent(uid)}`))).then(() => {
						ajaxify.refresh();
					}).catch(alerts.error);
					break;
				}
			}
		});
	};

	function handleTabNavigation(detailsPage) {
		if (window.location.hash) {
			const tabId = window.location.hash.slice(1);
			const tabToggle = document.querySelector(
				`[data-bs-toggle="tab"][data-bs-target="#groups-${tabId}"]`
			);
			if (tabToggle) {
				bootstrap.Tab.getOrCreateInstance(tabToggle).show();
			}
		}

		detailsPage.find('[data-bs-toggle="tab"]').on('shown.bs.tab', function (event) {
			const tabTarget = event.target.getAttribute('data-bs-target');
			if (!tabTarget || !tabTarget.startsWith('#')) {
				return;
			}

			const paneId = tabTarget.slice(1);
			const hash = paneId.startsWith('groups-') ? `#${paneId.slice('groups-'.length)}` : tabTarget;
			if (window.location.hash !== hash) {
				history.replaceState(null, '', hash);
			}
		});
	}

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
				const icon = previewIcon.val();
				previewIcon.toggleClass('hidden', !icon || icon === 'fa-nbb-none');
				iconValueEl.val(icon);
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
				const cids = new Set(($('#memberPostCids').val() || '').split(',').filter(Boolean));
				if (cids.has(String(selectedCategory.cid))) {
					cids.delete(String(selectedCategory.cid));
				} else {
					cids.add(String(selectedCategory.cid));
				}

				$('#memberPostCids').val(Array.from(cids).join(','));
				cidSelector.selectCategory(0);
				return false;
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
		modals.confirm(tx.compile('groups:details.delete-group-confirm', utils.escapeHTML(groupName)), function (confirm) {
			if (confirm) {
				modals.prompt('[[groups:details.delete-group-confirm-label]]', function (response) {
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

	async function handleMemberInvitations() {
		if (!ajaxify.data.group.isOwner) {
			return;
		}
		const selectedUids = new Map();
		const html = await Benchpress.render('partials/groups/invite-members', {});
		const modal = await modals.dialog({
			title: '[[groups:invite-members]]',
			message: html,
			buttons: {
				OK: {
					label: '[[groups:invite-members]]',
					callback: async function () {
						const isBulk = modal.find('.tab-pane.active').attr('id') === 'bulk-invite-pane';
						const uidsToInvite = isBulk ? await getBulkInviteUids() : Array.from(selectedUids.keys());
						for (const uid of uidsToInvite) {
							// eslint-disable-next-line no-await-in-loop
							await doInvite(uid);
						}
						updateList();
						modal.modal('hide');
					},
				},
			},
		});

		async function doInvite(uid) {
			return api.post(`/groups/${ajaxify.data.group.slug}/invites/${uid}`)
				.catch(alerts.error);
		}

		modal.on('shown.bs.modal', function () {
			const searchInput = modal.find('[component="groups/members/invite"]');
			autocomplete.user(searchInput, async function (event, selected) {
				selectedUids.set(selected.item.user.uid, selected.item.user);
				await renderSelectedUsers();
				searchInput.val('');
			});
		});

		async function updateList() {
			const data = await api.get(`/api/groups/${ajaxify.data.group.slug}`);
			const html = await app.parseAndTranslate('groups/details', 'group.invited', { group: data.group });
			$('[component="groups/invited"] tbody').html(html);
			updateInviteAlertVisibility();
			memberList.refresh(data);
		}

		async function renderSelectedUsers() {
			const html = await app.parseAndTranslate('partials/groups/invite-members', 'selectedUsers', { selectedUsers: Array.from(selectedUids.values()) });
			modal.find('[component="groups/members/invite-results"]').html(html);
		}

		modal.find('[component="groups/members/invite-results"]').on('click', '[data-action="remove"]', function () {
			const userEl = $(this).closest('[data-uid]');
			const uid = userEl.data('uid');
			selectedUids.delete(uid);
			userEl.remove();
		});

		async function getBulkInviteUids() {
			const usernames = $('[component="groups/members/bulk-invite"]').val();
			if (!usernames) {
				return [];
			}

			// Filter out bad usernames
			const userslugs = usernames.split(',').map(slugify);
			const validSlugs = (await Promise.all(
				userslugs.map(slug => api.head(`/users/bySlug/${slug}`).then(() => slug).catch(() => false))
			)).filter(Boolean);

			const uids = await Promise.all(validSlugs.map(slug => api.get(`/users/bySlug/${slug}`).then(({ uid }) => uid)));
			return uids;
		}
	}

	function removeCover() {
		modals.confirm('[[groups:remove-group-cover-confirm]]', function (confirm) {
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
