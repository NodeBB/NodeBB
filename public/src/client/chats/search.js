'use strict';


define('forum/chats/search', ['components', 'api', 'alerts'], function (components, api, alerts) {
	const search = {};

	search.init = function () {
		components.get('chat/search').on('keyup', utils.debounce(doSearch, 250));
	};

	function doSearch() {
		const username = components.get('chat/search').val();
		if (!username) {
			return $('[component="chat/search/list"]').empty();
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
			return chatsListEl.translateHtml('<li><div><span>[[users:no-users-found]]</span></div></li>');
		}

		data.users.forEach(function (userObj) {
			const chatEl = displayUser(chatsListEl, userObj);
			onUserClick(chatEl, userObj);
		});

		chatsListEl.parent().toggleClass('open', true);
	}

	function displayUser(chatsListEl, userObj) {
		function createUserImage() {
			return (userObj.picture ?
				'<img src="' + userObj.picture + '" title="' + userObj.username + '" />' :
				'<div class="user-icon" style="background-color: ' + userObj['icon:bgColor'] + '">' + userObj['icon:text'] + '</div>') +
				'<i class="fa fa-circle status ' + userObj.status + '"></i> ' + userObj.username;
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
