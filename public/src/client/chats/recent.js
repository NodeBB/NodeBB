'use strict';


define('forum/chats/recent', ['alerts', 'api', 'chat'], function (alerts, api, chat) {
	const recent = {};

	recent.init = function () {
		require(['forum/chats'], function (Chats) {
			$('[component="chat/nav-wrapper"]')
				.on('click', '[component="chat/recent/room"], [component="chat/public/room"]', function (e) {
					e.stopPropagation();
					e.preventDefault();
					const roomId = this.getAttribute('data-roomid');
					Chats.switchChat(roomId);
				})
				.on('click', '.mark-read', function (e) {
					e.stopPropagation();
					const chatEl = this.closest('[data-roomid]');
					chat.toggleReadState(chatEl);
				});

			$('[component="chat/recent"]').on('scroll', utils.debounce(function () {
				const $this = $(this);
				const bottom = ($this[0].scrollHeight - $this.height()) * 0.9;
				if ($this.scrollTop() > bottom) {
					loadMoreRecentChats();
				}
			}, 100));
		});
	};

	function loadMoreRecentChats() {
		const recentChats = $('[component="chat/recent"]');
		if (recentChats.attr('loading')) {
			return;
		}
		recentChats.attr('loading', 1);
		socket.emit('modules.chats.getRecentChats', {
			uid: ajaxify.data.uid,
			after: recentChats.attr('data-nextstart'),
		}, function (err, data) {
			if (err) {
				return alerts.error(err);
			}

			if (data && data.rooms.length) {
				onRecentChatsLoaded(data, function () {
					recentChats.removeAttr('loading');
					recentChats.attr('data-nextstart', data.nextStart);
				});
			} else {
				recentChats.removeAttr('loading');
			}
		});
	}

	function onRecentChatsLoaded(data, callback) {
		if (!data.rooms.length) {
			return callback();
		}
		data.loadingMore = true;
		app.parseAndTranslate('chats', 'rooms', data, function (html) {
			$('[component="chat/recent"]').append(html);
			html.find('.timeago').timeago();
			callback();
		});
	}


	return recent;
});
