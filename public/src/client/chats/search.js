'use strict';


define('forum/chats/search', [
	'components', 'api', 'alerts', 'helpers',
], function (components, api, alerts, helpers) {
	const search = {};

	search.init = function () {
		components.get('chat/search').on('keyup', utils.debounce(doSearch, 250));
	};

	function doSearch() {
		const username = components.get('chat/search').val();
		if (!username) {
			return $('[component="chat/search/list"]').translateHtml('<li><a href="#" class="dropdown-item">[[admin/menu:search.start-typing]]</a></li>');
		}

		api.get('/api/users', {
			query: username,
			searchBy: 'username',
			paginate: false,
		}).then(displayResults)
			.catch(alerts.error);
	}

	function displayResults(data) {
		const chatsListEl = $('[component="chat/search/list"]');
		chatsListEl.empty();

		data.users = data.users.filter(function (user) {
			return parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
		});

		if (!data.users.length) {
			return chatsListEl.translateHtml('<li><a href="#" class="dropdown-item">[[users:no-users-found]]</a></li>');
		}

		data.users.forEach(function (userObj) {
			const chatEl = displayUser(chatsListEl, userObj);
			onUserClick(chatEl, userObj);
		});

		chatsListEl.parent().toggleClass('open', true);
	}

	function displayUser(chatsListEl, userObj) {
		function createUserImage() {
			const img = helpers.buildAvatar(userObj, '24px', true);
			return `<a href="#" class="dropdown-item">${img} ${userObj.username}<a>`;
		}

		const chatEl = $('<li component="chat/search/user"></li>')
			.attr('data-uid', userObj.uid)
			.appendTo(chatsListEl);

		chatEl.append(createUserImage());
		return chatEl;
	}

	function onUserClick(chatEl, userObj) {
		chatEl.on('click', function () {
			socket.emit('modules.chats.hasPrivateChat', userObj.uid, function (err, roomId) {
				if (err) {
					return alerts.error(err);
				}
				if (roomId) {
					require(['forum/chats'], function (chats) {
						chats.switchChat(roomId);
					});
				} else {
					require(['chat'], function (chat) {
						chat.newChat(userObj.uid);
					});
				}
			});
		});
	}

	return search;
});
