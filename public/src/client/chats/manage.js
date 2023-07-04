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
				buttons: {
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: function () {
							api.put(`/chats/${roomId}`, {
								groups: modal.find('[component="chat/room/groups"]').val(),
							}).then((payload) => {
								ajaxify.data.groups = payload.groups;
							}).catch(alerts.error);
						},
					},
				},
			});

			modal.attr('component', 'chat/manage-modal');

			refreshParticipantsList(roomId, modal);
			addKickHandler(roomId, modal);
			userList.addInfiniteScrollHandler(roomId, modal.find('[component="chat/manage/user/list"]'), async (listEl, data) => {
				listEl.append(await app.parseAndTranslate('partials/chats/manage-room-users', data));
			});

			const searchInput = modal.find('input');
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

	async function refreshParticipantsList(roomId, modal, data) {
		const listEl = modal.find('.list-group');

		if (!data) {
			try {
				data = await api.get(`/chats/${roomId}/users`, {});
			} catch (err) {
				listEl.find('li').text(await translator.translate('[[error:invalid-data]]'));
			}
		}

		listEl.html(await app.parseAndTranslate('partials/chats/manage-room-users', data));
	}

	return manage;
});
