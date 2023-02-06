'use strict';


define('forum/chats/recent', ['alerts'], function (alerts) {
	const recent = {};

	recent.init = function () {
		require(['forum/chats'], function (Chats) {
			$('[component="chat/recent"]')
				.on('click', '[component="chat/recent/room"]', function (e) {
					e.stopPropagation();
					e.preventDefault();
					const roomId = this.getAttribute('data-roomid');
					Chats.switchChat(roomId);
				})
				.on('click', '.mark-read', function (e) {
					e.stopPropagation();
					const chatEl = this.closest('[data-roomid]');
					const unread = chatEl.classList.contains('unread');
					if (unread) {
						const roomId = chatEl.getAttribute('data-roomid');
						socket.emit('modules.chats.markRead', roomId);
						chatEl.classList.remove('unread');
						this.querySelector('.unread').classList.add('hidden');
						this.querySelector('.read').classList.remove('hidden');
					}
				});

			$('[component="chat/recent"]').on('scroll', function () {
				const $this = $(this);
				const bottom = ($this[0].scrollHeight - $this.height()) * 0.9;
				if ($this.scrollTop() > bottom) {
					loadMoreRecentChats();
				}
			});
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

		app.parseAndTranslate('chats', 'rooms', data, function (html) {
			$('[component="chat/recent"]').append(html);
			html.find('.timeago').timeago();
			callback();
		});
	}


	return recent;
});
