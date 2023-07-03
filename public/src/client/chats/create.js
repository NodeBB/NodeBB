'use strict';


define('forum/chats/create', [
	'components', 'api', 'alerts', 'forum/chats/search',
], function (components, api, alerts, search) {
	const create = {};
	create.init = function () {
		components.get('chat/create').on('click', handleCreate);
	};

	async function handleCreate() {
		let groups = [];
		if (app.user.isAdmin) {
			groups = await socket.emit('groups.getChatGroups', {});
		}
		const html = await app.parseAndTranslate('modals/create-room', {
			user: app.user,
			groups: groups,
		});

		const modal = bootbox.dialog({
			title: '[[modules:chat.create-room]]',
			message: html,
			buttons: {
				save: {
					label: '[[global:create]]',
					className: 'btn-primary',
					callback: async function () {
						const roomName = modal.find('[component="chat/room/name"]').val();
						const uids = modal.find('[component="chat/room/users"]').find('[data-uid]').map(
							(i, el) => $(el).attr('data-uid')
						).get();
						const type = modal.find('[component="chat/room/type"]').val();
						const groups = modal.find('[component="chat/room/groups"]').val();

						if (type === 'private' && !uids.length) {
							alerts.error('[[error:no-users-selected]]');
							return false;
						}
						if (type === 'public' && !groups) {
							alerts.error('[[error:no-groups-selected]]');
							return false;
						}
						await createRoom({
							roomName: roomName,
							uids: uids,
							type: type,
							groups: groups,
						});
					},
				},
			},
		});

		const chatRoomUsersList = modal.find('[component="chat/room/users"]');

		search.init({
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
			modal.find('[component="chat/room/groups"]').toggleClass('hidden', type === 'private');
		});
	}

	async function createRoom(params) {
		console.log(params);
		if (!app.user.uid) {
			return alerts.error('[[error:not-logged-in]]');
		}
		const { roomId } = await api.post(`/chats`, params);
		console.log('gg', roomId);
		ajaxify.go('chats/' + roomId);
	}

	return create;
});
