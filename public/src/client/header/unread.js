'use strict';

define('forum/header/unread', function () {
	const unread = {};
	const watchStates = {
		ignoring: 1,
		notwatching: 2,
		watching: 3,
	};

	unread.initUnreadTopics = function () {
		const unreadTopics = app.user.unreadData;

		function onNewPost(data) {
			if (data && data.posts && data.posts.length && unreadTopics) {
				const post = data.posts[0];
				if (parseInt(post.uid, 10) === parseInt(app.user.uid, 10) ||
					(!post.topic.isFollowing && post.categoryWatchState !== watchStates.watching)
				) {
					return;
				}

				const tid = post.topic.tid;
				if (!unreadTopics[''][tid] || !unreadTopics.new[tid] ||
					!unreadTopics.watched[tid] || !unreadTopics.unreplied[tid]) {
					markTopicsUnread(tid);
				}

				if (!unreadTopics[''][tid]) {
					increaseUnreadCount('');
					unreadTopics[''][tid] = true;
				}
				const isNewTopic = post.isMain && parseInt(post.uid, 10) !== parseInt(app.user.uid, 10);
				if (isNewTopic && !unreadTopics.new[tid]) {
					increaseUnreadCount('new');
					unreadTopics.new[tid] = true;
				}
				const isUnreplied = parseInt(post.topic.postcount, 10) <= 1;
				if (isUnreplied && !unreadTopics.unreplied[tid]) {
					increaseUnreadCount('unreplied');
					unreadTopics.unreplied[tid] = true;
				}

				if (post.topic.isFollowing && !unreadTopics.watched[tid]) {
					increaseUnreadCount('watched');
					unreadTopics.watched[tid] = true;
				}
			}
		}

		function increaseUnreadCount(filter) {
			const unreadUrl = '/unread' + (filter ? '?filter=' + filter : '');
			const newCount = 1 + parseInt($('a[href="' + config.relative_path + unreadUrl + '"].navigation-link i').attr('data-content'), 10);
			updateUnreadTopicCount(unreadUrl, newCount);
		}

		function markTopicsUnread(tid) {
			$('[data-tid="' + tid + '"]').addClass('unread');
		}

		$(window).on('action:ajaxify.end', function () {
			if (ajaxify.data.template.topic) {
				['', 'new', 'watched', 'unreplied'].forEach(function (filter) {
					delete unreadTopics[filter][ajaxify.data.tid];
				});
			}
		});
		socket.removeListener('event:new_post', onNewPost);
		socket.on('event:new_post', onNewPost);

		socket.removeListener('event:unread.updateCount', updateUnreadCounters);
		socket.on('event:unread.updateCount', updateUnreadCounters);
	};

	function updateUnreadCounters(data) {
		updateUnreadTopicCount('/unread', data.unreadTopicCount);
		updateUnreadTopicCount('/unread?filter=new', data.unreadNewTopicCount);
		updateUnreadTopicCount('/unread?filter=watched', data.unreadWatchedTopicCount);
		updateUnreadTopicCount('/unread?filter=unreplied', data.unreadUnrepliedTopicCount);
	}

	function updateUnreadTopicCount(url, count) {
		if (!utils.isNumber(count)) {
			return;
		}

		$('a[href="' + config.relative_path + url + '"].navigation-link i')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 99 ? '99+' : count);

		$('#mobile-menu [data-unread-url="' + url + '"]').attr('data-content', count > 99 ? '99+' : count);
	}
	unread.updateUnreadTopicCount = updateUnreadTopicCount;

	return unread;
});
