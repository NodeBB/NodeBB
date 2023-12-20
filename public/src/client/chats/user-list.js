'use strict';


define('forum/chats/user-list', ['api'], function (api) {
	const userList = {};

	let updateInterval = 0;

	userList.init = function (roomId, container) {
		const userListEl = container.find('[component="chat/user/list"]');
		if (!userListEl.length) {
			return;
		}
		const pinnedMessageListEl = container.find('[component="chat/messages/pinned/container"]');
		container.find('[component="chat/user/list/btn"]').on('click', () => {
			userListEl.toggleClass('hidden');
			if (userListEl.hasClass('hidden')) {
				stopUpdating();
			} else {
				pinnedMessageListEl.addClass('hidden');
				startUpdating(roomId, userListEl);
			}
		});

		$(window).off('action:ajaxify.start', stopUpdating)
			.one('action:ajaxify.start', stopUpdating);

		userList.addInfiniteScrollHandler(roomId, userListEl, async (listEl, data) => {
			listEl.append(await app.parseAndTranslate('partials/chats/user-list', 'users', data));
		});
	};

	function startUpdating(roomId, userListEl) {
		if (updateInterval) {
			clearInterval(updateInterval);
		}
		updateInterval = setInterval(() => {
			updateUserList(roomId, userListEl);
		}, 5000);
	}

	function stopUpdating() {
		if (updateInterval) {
			clearInterval(updateInterval);
			updateInterval = 0;
		}
	}

	async function updateUserList(roomId, userListEl) {
		if (ajaxify.data.template.chats && app.isFocused && userListEl.scrollTop() === 0 && !userListEl.hasClass('hidden')) {
			const data = await api.get(`/chats/${roomId}/users`, { start: 0 });
			userListEl.find('[data-bs-toggle="tooltip"]').tooltip('dispose');
			userListEl.html(await app.parseAndTranslate('partials/chats/user-list', 'users', data));
			userListEl.find('[data-bs-toggle="tooltip"]').tooltip();
		}
	}

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
			const query = inputEl.val();
			const data = await api.get(`/search/chats/${roomId}/users`, { query });
			callback(data);
		}, 200));
	};

	return userList;
});
