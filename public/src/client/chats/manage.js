'use strict';


define('forum/chats/manage', [
	'api', 'alerts', 'translator',
], function (api, alerts, translator) {
	const manage = {};

	manage.init = function (roomId, buttonEl) {
		let modal;

		buttonEl.on('click', function () {
			app.parseAndTranslate('modals/manage-room', {}, function (html) {
				modal = bootbox.dialog({
					title: '[[modules:chat.manage-room]]',
					message: html,
				});

				modal.attr('component', 'chat/manage-modal');

				refreshParticipantsList(roomId, modal);
				addKickHandler(roomId, modal);
				addInfiniteScrollHandler(roomId, modal);

				const searchInput = modal.find('input');
				const errorEl = modal.find('.text-danger');
				require(['autocomplete', 'translator'], function (autocomplete, translator) {
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

	function addInfiniteScrollHandler(roomId, modal) {
		const listEl = modal.find('[component="chat/manage/user/list"]');
		listEl.on('scroll', utils.debounce(async () => {
			const bottom = (listEl[0].scrollHeight - listEl.height()) * 0.85;
			if (listEl.scrollTop() > bottom) {
				const lastIndex = listEl.find('[data-index]').last().attr('data-index');
				const data = await api.get(`/chats/${roomId}/users`, {
					start: parseInt(lastIndex, 10) + 1,
				});
				if (data && data.users.length) {
					listEl.append(await app.parseAndTranslate('partials/chats/manage-room-users', data));
				}
			}
		}, 200));
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
