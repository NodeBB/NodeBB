'use strict';


define('forum/chats/search', [
	'components', 'api', 'alerts',
], function (components, api, alerts) {
	const search = {};

	search.init = function () {
		components.get('chat/search').on('keyup', utils.debounce(doSearch, 250));
		const chatsListEl = $('[component="chat/search/list"]');
		chatsListEl.on('click', '[data-uid]', function () {
			onUserClick($(this).attr('data-uid'));
		});
	};

	function doSearch() {
		const chatsListEl = $('[component="chat/search/list"]');
		const username = components.get('chat/search').val();
		if (!username) {
			removeResults(chatsListEl);
			chatsListEl.find('[component="chat/search/no-users"]').addClass('hidden');
			return chatsListEl.find('[component="chat/search/start-typing"]').removeClass('hidden');
		}
		chatsListEl.find('[component="chat/search/start-typing"]').addClass('hidden');
		api.get('/api/users', {
			query: username,
			searchBy: 'username',
			paginate: false,
		}).then(displayResults)
			.catch(alerts.error);
	}

	function removeResults(chatsListEl) {
		chatsListEl.find('[data-uid]').remove();
	}

	async function displayResults(data) {
		const chatsListEl = $('[component="chat/search/list"]');
		removeResults(chatsListEl);
		data.users = data.users.filter(function (user) {
			return parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
		});

		if (!data.users.length) {
			return chatsListEl.find('[component="chat/search/no-users"]').removeClass('hidden');
		}
		chatsListEl.find('[component="chat/search/no-users"]').addClass('hidden');
		const html = await app.parseAndTranslate('chats', 'searchUsers', { searchUsers: data.users });
		chatsListEl.append(html);
		chatsListEl.parent().toggleClass('show', true);
	}

	function onUserClick(uid) {
		if (!uid) {
			return;
		}
		socket.emit('modules.chats.hasPrivateChat', uid, function (err, roomId) {
			if (err) {
				return alerts.error(err);
			}
			if (roomId) {
				require(['forum/chats'], function (chats) {
					chats.switchChat(roomId);
				});
			} else {
				require(['chat'], function (chat) {
					chat.newChat(uid);
				});
			}
		});
	}

	return search;
});
