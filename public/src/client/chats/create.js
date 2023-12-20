'use strict';


define('forum/chats/create', [
	'components', 'api', 'alerts', 'forum/chats/user-search',
], function (components, api, alerts, userSearch) {
	const create = {};
	create.init = function () {
		components.get('chat/create').on('click', handleCreate);
	};

	async function handleCreate() {
		let groups = [];
		if (app.user.isAdmin) {
			({ groups } = await api.get('/admin/groups'));
			groups.sort((a, b) => b.system - a.system).map((g) => {
				const { name, displayName } = g;
				return { name, displayName };
			});
		}
		const html = await app.parseAndTranslate('modals/create-room', {
			user: app.user,
			groups,
		});

		const modal = bootbox.dialog({
			title: '[[modules:chat.create-room]]',
			message: html,
			onEscape: true,
			buttons: {
				save: {
					label: '[[global:create]]',
					className: 'btn-primary',
					callback: function () {
						const roomName = modal.find('[component="chat/room/name"]').val();
						const uids = modal.find('[component="chat/room/users"] [component="chat/user"]').find('[data-uid]').map(
							(i, el) => $(el).attr('data-uid')
						).get();
						const type = modal.find('[component="chat/room/type"]').val();
						const groups = modal.find('[component="chat/room/groups"]').val();

						if (type === 'private' && !uids.length) {
							alerts.error('[[error:no-users-selected]]');
							return false;
						}
						if (type === 'public' && !groups.length) {
							alerts.error('[[error:no-groups-selected]]');
							return false;
						}
						if (!app.user.uid) {
							alerts.error('[[error:not-logged-in]]');
							return false;
						}

						api.post(`/chats`, {
							roomName: roomName,
							uids: uids,
							type: type,
							groups: groups,
						}).then(({ roomId }) => {
							ajaxify.go('chats/' + roomId);
							modal.modal('hide');
						}).catch(alerts.error);
						return false;
					},
				},
			},
		});

		const chatRoomUsersList = modal.find('[component="chat/room/users"]');

		userSearch.init({
			onSelect: async function (user) {
				const html = await app.parseAndTranslate('modals/create-room', 'selectedUsers', { selectedUsers: [user] });
				chatRoomUsersList.append(html);
			},
		});

		chatRoomUsersList.on('click', '[component="chat/room/users/remove"]', function () {
			$(this).parents('[data-uid]').remove();
		});


		modal.find('[component="chat/room/type"]').on('change', function () {
			const type = $(this).val();
			modal.find('[component="chat/room/public/options"]').toggleClass('hidden', type === 'private');
		});
	}

	return create;
});
