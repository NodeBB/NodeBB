'use strict';


define('forum/footer', ['notifications', 'chat', 'components', 'translator'], function (Notifications, Chat, components, translator) {
	Notifications.prepareDOM();
	Chat.prepareDOM();
	translator.prepareDOM();

	function updateUnreadTopicCount(url, count) {
		if (!utils.isNumber(count)) {
			return;
		}
		$('#header-menu a[href="' + config.relative_path + url + '"] i')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 99 ? '99+' : count);
	}

	function updateUnreadChatCount(count) {
		components.get('chat/icon')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 99 ? '99+' : count);
	}

	function initUnreadTopics() {
		var unreadTopics = {};

		function onNewPost(data) {
			if (data && data.posts && data.posts.length) {
				var post = data.posts[0];

				if (parseInt(post.uid, 10) !== parseInt(app.user.uid, 10) && !unreadTopics[post.topic.tid]) {
					increaseUnreadCount();
					markTopicsUnread(post.topic.tid);
					unreadTopics[post.topic.tid] = true;
				}
			}
		}

		function increaseUnreadCount() {
			var count = parseInt($('#unread-count i').attr('data-content'), 10) + 1;

			updateUnreadTopicCount('/unread', count);
		}

		function markTopicsUnread(tid) {
			$('[data-tid="' + tid + '"]').addClass('unread');
		}

		$(window).on('action:ajaxify.end', function (ev, data) {
			if (data.url) {
				var tid = data.url.match(/^topic\/(\d+)/);

				if (tid && tid[1]) {
					delete unreadTopics[tid[1]];
				}
			}
		});

		socket.on('event:new_post', onNewPost);
	}

	if (app.user.uid) {
		socket.emit('user.getUnreadCounts', function (err, data) {
			if (err) {
				return app.alert(err.message);
			}

			updateUnreadCounters(data);

			updateUnreadChatCount(data.unreadChatCount);
			Notifications.updateNotifCount(data.unreadNotificationCount);
		});
	}

	function updateUnreadCounters(data) {
		updateUnreadTopicCount('/unread', data.unreadTopicCount);
		updateUnreadTopicCount('/unread/new', data.unreadNewTopicCount);
		updateUnreadTopicCount('/unread/watched', data.unreadWatchedTopicCount);
	}

	socket.on('event:unread.updateCount', updateUnreadCounters);
	socket.on('event:unread.updateChatCount', updateUnreadChatCount);

	initUnreadTopics();
});
