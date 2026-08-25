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

			let previousScrollTop = $('[component="chat/recent"]').scrollTop();
			$('[component="chat/recent"]').on('scroll', utils.debounce(function () {
				const $this = $(this);
				const currentScrollTop = $this.scrollTop();
				const direction = currentScrollTop > previousScrollTop ? 1 : -1;
				previousScrollTop = currentScrollTop;
				const scrollPercent = 100 * (currentScrollTop / ($this[0].scrollHeight - $this.height()));
				if (direction === 1 && scrollPercent > 85) {
					loadMoreRecentChats(direction);
				} else if (direction === -1 && scrollPercent < 15) {
					loadMoreRecentChats(direction);
				}
			}, 100));
		});
	};

	async function loadMoreRecentChats(direction) {
		const recentChats = $('[component="chat/recent"]');
		if (recentChats.attr('loading')) {
			return;
		}
		const prevStart = parseInt(recentChats.attr('data-prevstart'), 10) || 0;
		if (direction < 0 && prevStart <= 0) {
			return;
		}
		const params = { uid: ajaxify.data.uid };
		if (direction > 0) {
			params.start = recentChats.attr('data-nextstart');
		} else {
			params.start = Math.max(0, prevStart - 30);
			params.perPage = prevStart - params.start;
		}
		recentChats.attr('loading', 1);
		try {
			const { rooms, nextStart } = await api.get(`/chats`, params);
			if (rooms.length) {
				await onRecentChatsLoaded({ rooms, nextStart }, direction);
				if (direction > 0) {
					recentChats.attr('data-nextstart', nextStart);
				} else {
					recentChats.attr('data-prevstart', params.start);
				}
			}
		} catch (err) {
			alerts.error(err);
		} finally {
			recentChats.removeAttr('loading');
		}
	}

	async function onRecentChatsLoaded(data, direction) {
		if (!data.rooms.length) {
			return;
		}
		if (direction > 0) {
			data.loadingMore = true;
		} else {
			data.showBottomHr = true;
		}
		const html = await app.parseAndTranslate('chats', 'rooms', data);
		const recentChats = $('[component="chat/recent"]');
		if (direction > 0) {
			recentChats.append(html);
		} else {
			// preserve the scroll position when prepending rooms above the viewport
			const listEl = recentChats.get(0);
			const previousHeight = listEl.scrollHeight;
			recentChats.prepend(html);
			listEl.scrollTop += listEl.scrollHeight - previousHeight;
		}
		html.find('.timeago').timeago();
	}


	return recent;
});
