'use strict';


define('forum/chats/manage', [
	'api', 'alerts', 'translator', 'autocomplete', 'forum/chats/user-list',
], function (api, alerts, translator, autocomplete, userList) {
	const manage = {};

	manage.init = function (roomId, buttonEl) {
		let modal;

		buttonEl.on('click', async function () {
			let groups = [];
			if (app.user.isAdmin) {
				({ groups } = await api.get('/admin/groups'));
				groups.sort((a, b) => b.system - a.system).map((g) => {
					const { name, displayName } = g;
					return { name, displayName };
				});

				if (Array.isArray(ajaxify.data.groups)) {
					groups.forEach((g) => {
						g.selected = ajaxify.data.groups.includes(g.name);
					});
				}
			}

			const html = await app.parseAndTranslate('modals/manage-room', {
				groups,
				user: app.user,
				room: ajaxify.data,
			});
			modal = bootbox.dialog({
				title: '[[modules:chat.manage-room]]',
				size: 'large',
				message: html,
				onEscape: true,
			});

			modal.attr('component', 'chat/manage-modal');

			refreshParticipantsList(roomId, modal);
			addKickHandler(roomId, modal);
			addToggleOwnerHandler(roomId, modal);

			const userListEl = modal.find('[component="chat/manage/user/list"]');
			const userListElSearch = modal.find('[component="chat/manage/user/list/search"]');
			userList.addSearchHandler(roomId, userListElSearch, async (data) => {
				if (userListElSearch.val()) {
					userListEl.html(await app.parseAndTranslate('partials/chats/manage-room-users', data));
				} else {
					refreshParticipantsList(roomId, modal);
				}
			});

			userList.addInfiniteScrollHandler(roomId, userListEl, async (listEl, data) => {
				listEl.append(await app.parseAndTranslate('partials/chats/manage-room-users', data));
			});

			const searchInput = modal.find('[component="chat/manage/user/add/search"]');
			const errorEl = modal.find('.text-danger');
			autocomplete.user(searchInput, function (event, selected) {
				errorEl.text('');
				api.post(`/chats/${roomId}/users`, {
					uids: [selected.item.user.uid],
				}).then((body) => {
					refreshParticipantsList(roomId, modal, body);
					searchInput.val('');
				}).catch((err) => {
					translator.translate(err.message, function (translated) {
						errorEl.text(translated);
					});
				});
			});

			modal.find('[component="chat/manage/save"]').on('click', () => {
				const notifSettingEl = modal.find('[component="chat/room/notification/setting"]');
				const joinLeaveMessagesEl = modal.find('[component="chat/room/join-leave-messages"]');

				api.put(`/chats/${roomId}`, {
					groups: modal.find('[component="chat/room/groups"]').val(),
					notificationSetting: notifSettingEl.val(),
					joinLeaveMessages: joinLeaveMessagesEl.is(':checked') ? 1 : 0,
				}).then((payload) => {
					ajaxify.data.groups = payload.groups;
					ajaxify.data.notificationSetting = payload.notificationSetting;
					ajaxify.data.joinLeaveMessages = payload.joinLeaveMessages;
					const roomDefaultOption = payload.notificationOptions[0];
					$('[component="chat/notification/setting"] [data-icon]').first().attr(
						'data-icon', roomDefaultOption.icon
					);
					$('[component="chat/notification/setting/sub-label"]').translateText(
						roomDefaultOption.subLabel
					);
					if (roomDefaultOption.selected) {
						$('[component="chat/notification/setting/icon"]').attr(
							'class', `fa ${roomDefaultOption.icon}`
						);
					}

					modal.modal('hide');
				}).catch(alerts.error);
			});
		});
	};

	function addKickHandler(roomId, modal) {
		modal.on('click', '[data-action="kick"]', function () {
			const uid = encodeURIComponent(this.getAttribute('data-uid'));

			api.del(`/chats/${roomId}/users/${uid}`, {}).then((body) => {
				refreshParticipantsList(roomId, modal, body);
			}).catch(alerts.error);
		});
	}

	function addToggleOwnerHandler(roomId, modal) {
		modal.on('click', '[data-action="toggleOwner"]', async function () {
			const uid = String(this.getAttribute('data-uid'));
			const iconEl = modal.get(0).querySelector(`[component="chat/manage/user/list"] > [data-uid="${uid}"] [component="chat/manage/user/owner/icon"]`);
			const current = !iconEl.classList.contains('hidden');

			if (!utils.isNumber(uid)) {
				return alerts.error('[[error:invalid-uid]]');
			}

			await api[current ? 'del' : 'put'](`/chats/${roomId}/owners/${uid}`);
			iconEl.classList.toggle('hidden');
		});
	}

	async function refreshParticipantsList(roomId, modal, data) {
		const listEl = modal.find('[component="chat/manage/user/list"]');

		if (!data) {
			try {
				data = await api.get(`/chats/${roomId}/users`, {});
			} catch (err) {
				console.error(err);
				listEl.find('li').text(await translator.translate('[[error:invalid-data]]'));
			}
		}
		listEl.find('[data-bs-toggle="tooltip"]').tooltip('dispose');
		listEl.html(await app.parseAndTranslate('partials/chats/manage-room-users', data));
		listEl.find('[data-bs-toggle="tooltip"]').tooltip();
	}

	return manage;
});
