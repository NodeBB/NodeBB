'use strict';

define('forum/header/unread', ['hooks'], function (hooks) {
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
		count = Math.max(0, count);
		const countText = count > 99 ? '99+' : count;

		const navLink = $('a[href="' + config.relative_path + url + '"].navigation-link');
		// persona uses i with :after element
		navLink.find('i')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', countText);

		// harmony uses BS5 absolute positioned element
		navLink.find('[component="navigation/count"]')
			.toggleClass('hidden', count <= 0)
			.text(count);

		if (navLink.length) {
			// persona mobile menu uses data-content
			$('#mobile-menu [data-unread-url="' + url + '"]')
				.attr('data-content', countText);

			// harmony mobile unread badge, doesn't use data-content
			$('[component="unread/count"][data-unread-url="' + url + '"]')
				.toggleClass('hidden', count <= 0)
				.text(countText);
		}

		hooks.fire('action:unread.updateCount', { url, count });
	}
	unread.updateUnreadTopicCount = updateUnreadTopicCount;

	return unread;
});
