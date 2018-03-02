'use strict';


define('forum/chats/search', ['components'], function (components) {
	var search = {};

	search.init = function () {
		var timeoutId = 0;

		components.get('chat/search').on('keyup', function () {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			timeoutId = setTimeout(doSearch, 250);
		});
	};

	function doSearch() {
		var username = components.get('chat/search').val();
		var chatsListEl = $('[component="chat/search/list"]');

		if (!username) {
			return chatsListEl.empty();
		}

		socket.emit('user.search', {
			query: username,
			searchBy: 'username',
		}, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			displayResults(chatsListEl, data);
		});
	}

	function displayResults(chatsListEl, data) {
		chatsListEl.empty();

		data.users = data.users.filter(function (user) {
			return parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
		});

		if (!data.users.length) {
			return chatsListEl.translateHtml('<li><div><span>[[users:no-users-found]]</span></div></li>');
		}

		data.users.forEach(function (userObj) {
			var chatEl = displayUser(chatsListEl, userObj);
			onUserClick(chatEl, userObj);
		});

		chatsListEl.parent().toggleClass('open', true);
	}

	function displayUser(chatsListEl, userObj) {
		function createUserImage() {
			return (userObj.picture ?
				'<img src="' +	userObj.picture + '" title="' +	userObj.username + '" />' :
				'<div class="user-icon" style="background-color: ' + userObj['icon:bgColor'] + '">' + userObj['icon:text'] + '</div>') +
				'<i class="fa fa-circle status ' + userObj.status + '"></i> ' + userObj.username;
		}

		var chatEl = $('<li component="chat/search/user" />')
			.attr('data-uid', userObj.uid)
			.appendTo(chatsListEl);

		chatEl.append(createUserImage());
		return chatEl;
	}

	function onUserClick(chatEl, userObj) {
		chatEl.on('click', function () {
			socket.emit('modules.chats.hasPrivateChat', userObj.uid, function (err, roomId) {
				if (err) {
					return app.alertError(err.message);
				}
				if (roomId) {
					require(['forum/chats'], function (chats) {
						chats.switchChat(roomId);
					});
				} else {
					app.newChat(userObj.uid);
				}
			});
		});
	}

	return search;
});
