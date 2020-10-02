'use strict';


define('forum/topic/threadTools', [
	'components',
	'translator',
	'handleBack',
	'api',
], function (components, translator, handleBack, api) {
	var ThreadTools = {};

	ThreadTools.init = function (tid, topicContainer) {
		renderMenu(topicContainer);

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
			api.put(`/topics/${tid}/lock`);
			return false;
		});

		topicContainer.on('click', '[component="topic/unlock"]', function () {
			api.del(`/topics/${tid}/lock`);
			return false;
		});

		topicContainer.on('click', '[component="topic/pin"]', function () {
			api.put(`/topics/${tid}/pin`);
			return false;
		});

		topicContainer.on('click', '[component="topic/unpin"]', function () {
			api.del(`/topics/${tid}/pin`);
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread"]', function () {
			socket.emit('topics.markUnread', tid, function (err) {
				if (err) {
					return app.alertError(err);
				}

				if (app.previousUrl && !app.previousUrl.match('^/topic')) {
					ajaxify.go(app.previousUrl, function () {
						handleBack.onBackClicked(true);
					});
				} else if (ajaxify.data.category) {
					ajaxify.go('category/' + ajaxify.data.category.slug, handleBack.onBackClicked);
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
			require(['forum/topic/move'], function (move) {
				move.init([tid], ajaxify.data.cid);
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/delete/posts"]', function () {
			require(['forum/topic/delete-posts'], function (deletePosts) {
				deletePosts.init();
			});
		});

		topicContainer.on('click', '[component="topic/fork"]', function () {
			require(['forum/topic/fork'], function (fork) {
				fork.init();
			});
		});

		topicContainer.on('click', '[component="topic/move-posts"]', function () {
			require(['forum/topic/move-post'], function (movePosts) {
				movePosts.init();
			});
		});

		topicContainer.on('click', '[component="topic/following"]', function () {
			changeWatching('follow');
		});
		topicContainer.on('click', '[component="topic/not-following"]', function () {
			changeWatching('unfollow');
		});
		topicContainer.on('click', '[component="topic/ignoring"]', function () {
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

	function renderMenu(container) {
		container.on('show.bs.dropdown', '.thread-tools', function () {
			var $this = $(this);
			var dropdownMenu = $this.find('.dropdown-menu');
			if (dropdownMenu.html()) {
				return;
			}

			socket.emit('topics.loadTopicTools', { tid: ajaxify.data.tid, cid: ajaxify.data.cid }, function (err, data) {
				if (err) {
					return app.alertError(err);
				}
				app.parseAndTranslate('partials/topic/topic-menu-list', data, function (html) {
					dropdownMenu.html(html);
					$(window).trigger('action:topic.tools.load', {
						element: dropdownMenu,
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

				const method = command === 'restore' ? 'put' : 'del';
				const suffix = command !== 'purge' ? '/state' : '';
				api[method](`/topics/${tid}${suffix}`, undefined, undefined, err => app.alertError(err.status.message));
			});
		});
	}

	ThreadTools.setLockedState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		var isLocked = data.isLocked && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/lock').toggleClass('hidden', data.isLocked).parent().attr('hidden', data.isLocked ? '' : null);
		components.get('topic/unlock').toggleClass('hidden', !data.isLocked).parent().attr('hidden', !data.isLocked ? '' : null);

		var hideReply = !!((data.isLocked || ajaxify.data.deleted) && !ajaxify.data.privileges.isAdminOrMod);

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !data.isLocked || ajaxify.data.deleted);

		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);
		threadEl.find('[component="post/edit"], [component="post/delete"]').toggleClass('hidden', isLocked);

		threadEl.find('[component="post"][data-uid="' + app.user.uid + '"].deleted [component="post/tools"]').toggleClass('hidden', isLocked);

		$('.topic-header [component="topic/locked"]').toggleClass('hidden', !data.isLocked);
		$('[component="post/tools"] .dropdown-menu').html('');
		ajaxify.data.locked = data.isLocked;
	};

	ThreadTools.setDeleteState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/delete').toggleClass('hidden', data.isDelete).parent().attr('hidden', data.isDelete ? '' : null);
		components.get('topic/restore').toggleClass('hidden', !data.isDelete).parent().attr('hidden', !data.isDelete ? '' : null);
		components.get('topic/purge').toggleClass('hidden', !data.isDelete).parent().attr('hidden', !data.isDelete ? '' : null);
		components.get('topic/deleted/message').toggleClass('hidden', !data.isDelete);

		if (data.isDelete) {
			app.parseAndTranslate('partials/topic/deleted-message', {
				deleter: data.user,
				deleted: true,
				deletedTimestampISO: utils.toISOString(Date.now()),
			}, function (html) {
				components.get('topic/deleted/message').replaceWith(html);
				html.find('.timeago').timeago();
			});
		}
		var hideReply = data.isDelete && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !ajaxify.data.locked || data.isDelete);
		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);

		threadEl.toggleClass('deleted', data.isDelete);
		ajaxify.data.deleted = data.isDelete ? 1 : 0;
	};


	ThreadTools.setPinnedState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/pin').toggleClass('hidden', data.isPinned).parent().attr('hidden', data.isPinned ? '' : null);
		components.get('topic/unpin').toggleClass('hidden', !data.isPinned).parent().attr('hidden', !data.isPinned ? '' : null);
		$('.topic-header [component="topic/pinned"]').toggleClass('hidden', !data.isPinned);
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
