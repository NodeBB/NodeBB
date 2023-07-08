'use strict';


define('forum/chats/user-list', ['api'], function (api) {
	const userList = {};

	userList.init = function (roomId, container) {
		const userListEl = container.find('[component="chat/user/list"]');
		if (!userListEl.length) {
			return;
		}
		container.find('[component="chat/user/list/btn"]').on('click', () => {
			userListEl.toggleClass('hidden');
		});

		userList.addInfiniteScrollHandler(roomId, userListEl, async (listEl, data) => {
			listEl.append(await app.parseAndTranslate('partials/chats/user-list', 'users', data));
		});
	};

	userList.addInfiniteScrollHandler = function (roomId, listEl, callback) {
		listEl.on('scroll', utils.debounce(async () => {
			const bottom = (listEl[0].scrollHeight - listEl.height()) * 0.85;
			if (listEl.scrollTop() > bottom) {
				const lastIndex = listEl.find('[data-index]').last().attr('data-index');
				const data = await api.get(`/chats/${roomId}/users`, {
					start: parseInt(lastIndex, 10) + 1,
				});
				if (data && data.users.length) {
					callback(listEl, data);
				}
			}
		}, 200));
	};

	userList.addSearchHandler = function (roomId, inputEl, callback) {
		inputEl.on('keyup', utils.debounce(async () => {
			const username = inputEl.val();
			const data = await socket.emit('modules.chats.searchMembers', {
				username: username,
				roomId: roomId,
			});
			callback(data);
		}, 200));
	};

	return userList;
});
