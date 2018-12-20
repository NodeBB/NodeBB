'use strict';


define('forum/unread', ['topicSelect', 'components', 'topicList'], function (topicSelect, components, topicList) {
	var Unread = {};

	var watchStates = {
		ignoring: 1,
		notwatching: 2,
		watching: 3,
	};

	Unread.init = function () {
		app.enterRoom('unread_topics');

		topicList.init('unread');
		topicSelect.init();

		updateUnreadTopicCount('/' + ajaxify.data.selectedFilter.url, ajaxify.data.topicCount);

		$('#markSelectedRead').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return;
			}
			socket.emit('topics.markAsRead', tids, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});

		$('#markAllRead').on('click', function () {
			socket.emit('topics.markAllRead', function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[unread:topics_marked_as_read.success]]');

				$('[component="category"]').empty();
				$('[component="pagination"]').addClass('hidden');
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');
			});
		});

		$('.markread').on('click', '.category', function () {
			function getCategoryTids(cid) {
				var tids = [];
				components.get('category/topic', 'cid', cid).each(function () {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			var cid = $(this).attr('data-cid');
			var tids = getCategoryTids(cid);

			socket.emit('topics.markCategoryTopicsRead', cid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});
	};

	function doneRemovingTids(tids) {
		removeTids(tids);

		app.alertSuccess('[[unread:topics_marked_as_read.success]]');

		if (!$('[component="category"]').children().length) {
			$('#category-no-topics').removeClass('hidden');
			$('.markread').addClass('hidden');
		}
	}

	function removeTids(tids) {
		for (var i = 0; i < tids.length; i += 1) {
			components.get('category/topic', 'tid', tids[i]).remove();
		}
	}

	function updateUnreadTopicCount(url, count) {
		if (!utils.isNumber(count)) {
			return;
		}

		$('a[href="' + config.relative_path + url + '"].navigation-link i')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 99 ? '99+' : count);
	}

	Unread.initUnreadTopics = function () {
		var unreadTopics = app.user.unreadData;

		function onNewPost(data) {
			if (data && data.posts && data.posts.length) {
				var post = data.posts[0];
				if (parseInt(post.uid, 10) === parseInt(app.user.uid, 10) ||
					(!post.topic.isFollowing && post.categoryWatchState !== watchStates.watching)
				) {
					return;
				}

				var tid = post.topic.tid;
				if (!unreadTopics[''][tid] || !unreadTopics.new[tid] ||
					!unreadTopics.watched[tid] || !unreadTopics.unreplied[tid]) {
					markTopicsUnread(tid);
				}

				if (!unreadTopics[''][tid]) {
					increaseUnreadCount('');
					unreadTopics[''][tid] = true;
				}
				var isNewTopic = post.isMain && parseInt(post.uid, 10) !== parseInt(app.user.uid, 10);
				if (isNewTopic && !unreadTopics.new[tid]) {
					increaseUnreadCount('new');
					unreadTopics.new[tid] = true;
				}
				var isUnreplied = parseInt(post.topic.postcount, 10) <= 1;
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
			var unreadUrl = '/unread' + (filter ? '?filter=' + filter : '');
			var newCount = 1 + parseInt($('a[href="' + config.relative_path + unreadUrl + '"].navigation-link i').attr('data-content'), 10);
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

	return Unread;
});
