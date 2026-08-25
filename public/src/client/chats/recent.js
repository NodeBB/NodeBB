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

	async function loadMoreRecentChats() {
		const recentChats = $('[component="chat/recent"]');
		if (recentChats.attr('loading')) {
			return false;
		}
		recentChats.attr('loading', 1);
		try {
			const { rooms, nextStart } = await api.get(`/chats`, {
				uid: ajaxify.data.uid,
				start: recentChats.attr('data-nextstart'),
			});
			if (rooms.length) {
				await onRecentChatsLoaded({ rooms, nextStart });
				recentChats.attr('data-nextstart', nextStart);
			}
			return rooms.length > 0;
		} catch (err) {
			alerts.error(err);
			return false;
		} finally {
			recentChats.removeAttr('loading');
		}
	}

	recent.loadMore = loadMoreRecentChats;

	async function onRecentChatsLoaded(data) {
		if (!data.rooms.length) {
			return;
		}
		data.loadingMore = true;
		const html = await app.parseAndTranslate('chats', 'rooms', data);
		$('[component="chat/recent"]').append(html);
		html.find('.timeago').timeago();
	}


	return recent;
});
