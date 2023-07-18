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
				groups = await socket.emit('groups.getChatGroups', {});
				if (Array.isArray(ajaxify.data.groups)) {
					groups.forEach((g) => {
						g.selected = ajaxify.data.groups.includes(g.name);
					});
				}
			}

			const html = await app.parseAndTranslate('modals/manage-room', {
				groups,
				user: app.user,
				group: ajaxify.data,
			});
			modal = bootbox.dialog({
				title: '[[modules:chat.manage-room]]',
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

			modal.find('[component="chat/manage/save/groups"]').on('click', (ev) => {
				const btn = $(ev.target);
				api.put(`/chats/${roomId}`, {
					groups: modal.find('[component="chat/room/groups"]').val(),
				}).then((payload) => {
					ajaxify.data.groups = payload.groups;
					btn.addClass('btn-success');
					setTimeout(() => btn.removeClass('btn-success'), 1000);
				}).catch(alerts.error);
			});
		});
	};

	function addKickHandler(roomId, modal) {
		modal.on('click', '[data-action="kick"]', function () {
			const uid = parseInt(this.getAttribute('data-uid'), 10);

			api.del(`/chats/${roomId}/users/${uid}`, {}).then((body) => {
				refreshParticipantsList(roomId, modal, body);
			}).catch(alerts.error);
		});
	}

	function addToggleOwnerHandler(roomId, modal) {
		modal.on('click', '[data-action="toggleOwner"]', async function () {
			const uid = parseInt(this.getAttribute('data-uid'), 10);
			const $this = $(this);
			await socket.emit('modules.chats.toggleOwner', { roomId: roomId, uid: uid });
			$this.parents('[data-uid]')
				.find('[component="chat/manage/user/owner/icon"]')
				.toggleClass('hidden');
		});
	}

	async function refreshParticipantsList(roomId, modal, data) {
		const listEl = modal.find('[component="chat/manage/user/list"]');

		if (!data) {
			try {
				data = await api.get(`/chats/${roomId}/users`, {});
			} catch (err) {
				listEl.find('li').text(await translator.translate('[[error:invalid-data]]'));
			}
		}

		listEl.html(await app.parseAndTranslate('partials/chats/manage-room-users', data));
		listEl.find('[data-bs-toggle="tooltip"]').tooltip();
	}

	return manage;
});
