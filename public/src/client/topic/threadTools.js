'use strict';


define('forum/topic/threadTools', [
	'forum/topic/fork',
	'forum/topic/move',
	'forum/topic/delete-posts',
	'forum/topic/move-post',
	'components',
	'translator',
	'benchpress',
], function (fork, move, deletePosts, movePosts, components, translator, Benchpress) {
	var ThreadTools = {};

	ThreadTools.init = function (tid) {
		renderMenu();

		var topicContainer = $('.topic');

		topicContainer.on('click', '[component="topic/delete"]', function () {
			topicCommand('delete', tid);
			return false;
		});

		topicContainer.on('click', '[component="topic/restore"]', function () {
			topicCommand('restore', tid);
			return false;
		});

		topicContainer.on('click', '[component="topic/purge"]', function () {
			topicCommand('purge', tid);
			return false;
		});

		topicContainer.on('click', '[component="topic/lock"]', function () {
			socket.emit('topics.lock', { tids: [tid], cid: ajaxify.data.cid });
			return false;
		});

		topicContainer.on('click', '[component="topic/unlock"]', function () {
			socket.emit('topics.unlock', { tids: [tid], cid: ajaxify.data.cid });
			return false;
		});

		topicContainer.on('click', '[component="topic/pin"]', function () {
			socket.emit('topics.pin', { tids: [tid], cid: ajaxify.data.cid });
			return false;
		});

		topicContainer.on('click', '[component="topic/unpin"]', function () {
			socket.emit('topics.unpin', { tids: [tid], cid: ajaxify.data.cid });
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread"]', function () {
			socket.emit('topics.markUnread', tid, function (err) {
				if (err) {
					return app.alertError(err);
				}
				app.alertSuccess('[[topic:mark_unread.success]]');
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread-for-all"]', function () {
			var btn = $(this);
			socket.emit('topics.markAsUnreadForAll', [tid], function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
				btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/move"]', function () {
			move.init([tid], ajaxify.data.cid);
			return false;
		});

		deletePosts.init();
		fork.init();
		movePosts.init();

		$('.topic').on('click', '[component="topic/following"]', function () {
			changeWatching('follow');
		});
		$('.topic').on('click', '[component="topic/not-following"]', function () {
			changeWatching('unfollow');
		});
		$('.topic').on('click', '[component="topic/ignoring"]', function () {
			changeWatching('ignore');
		});

		function changeWatching(type) {
			socket.emit('topics.changeWatching', { tid: tid, type: type }, function (err) {
				if (err) {
					return app.alert({
						type: 'danger',
						alert_id: 'topic_follow',
						title: '[[global:please_log_in]]',
						message: '[[topic:login_to_subscribe]]',
						timeout: 5000,
					});
				}
				var message = '';
				if (type === 'follow') {
					message = '[[topic:following_topic.message]]';
				} else if (type === 'unfollow') {
					message = '[[topic:not_following_topic.message]]';
				} else if (type === 'ignore') {
					message = '[[topic:ignoring_topic.message]]';
				}
				setFollowState(type);

				app.alert({
					alert_id: 'follow_thread',
					message: message,
					type: 'success',
					timeout: 5000,
				});

				$(window).trigger('action:topics.changeWatching', { tid: tid, type: type });
			});

			return false;
		}
	};

	function renderMenu() {
		$('.topic').on('show.bs.dropdown', '.thread-tools', function () {
			var $this = $(this);
			var dropdownMenu = $this.find('.dropdown-menu');
			if (dropdownMenu.html()) {
				return;
			}

			socket.emit('topics.loadTopicTools', { tid: ajaxify.data.tid, cid: ajaxify.data.cid }, function (err, data) {
				if (err) {
					return app.alertError(err);
				}

				Benchpress.parse('partials/topic/topic-menu-list', data, function (html) {
					translator.translate(html, function (html) {
						dropdownMenu.html(html);
						$(window).trigger('action:topic.tools.load');
					});
				});
			});
		});
	}

	function topicCommand(command, tid) {
		translator.translate('[[topic:thread_tools.' + command + '_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('topics.' + command, { tids: [tid], cid: ajaxify.data.cid }, function (err) {
					if (err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	ThreadTools.setLockedState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		var isLocked = data.isLocked && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/lock').toggleClass('hidden', data.isLocked);
		components.get('topic/unlock').toggleClass('hidden', !data.isLocked);

		var hideReply = (data.isLocked || ajaxify.data.deleted) && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !data.isLocked || ajaxify.data.deleted);

		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);
		threadEl.find('[component="post/edit"], [component="post/delete"]').toggleClass('hidden', isLocked);

		threadEl.find('[component="post"][data-uid="' + app.user.uid + '"].deleted [component="post/tools"]').toggleClass('hidden', isLocked);

		$('[component="post/header"] i.fa-lock').toggleClass('hidden', !data.isLocked);
		$('[component="post/tools"] .dropdown-menu').html('');
		ajaxify.data.locked = data.isLocked;
	};

	ThreadTools.setDeleteState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/delete').toggleClass('hidden', data.isDelete);
		components.get('topic/restore').toggleClass('hidden', !data.isDelete);
		components.get('topic/purge').toggleClass('hidden', !data.isDelete);
		components.get('topic/deleted/message').toggleClass('hidden', !data.isDelete);

		var hideReply = data.isDelete && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !ajaxify.data.locked || data.isDelete);
		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);

		threadEl.toggleClass('deleted', data.isDelete);
		ajaxify.data.deleted = data.isDelete;
	};


	ThreadTools.setPinnedState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/pin').toggleClass('hidden', data.isPinned);
		components.get('topic/unpin').toggleClass('hidden', !data.isPinned);
		$('[component="post/header"] i.fa-thumb-tack').toggleClass('hidden', !data.isPinned);
		ajaxify.data.pinned = data.isPinned;
	};

	function setFollowState(state) {
		var menu = components.get('topic/following/menu');
		menu.toggleClass('hidden', state !== 'follow');
		components.get('topic/following/check').toggleClass('fa-check', state === 'follow');

		menu = components.get('topic/not-following/menu');
		menu.toggleClass('hidden', state !== 'unfollow');
		components.get('topic/not-following/check').toggleClass('fa-check', state === 'unfollow');

		menu = components.get('topic/ignoring/menu');
		menu.toggleClass('hidden', state !== 'ignore');
		components.get('topic/ignoring/check').toggleClass('fa-check', state === 'ignore');
	}


	return ThreadTools;
});
