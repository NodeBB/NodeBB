'use strict';

/* globals define, app, ajaxify, socket, bootbox, templates */

define('forum/topic/threadTools', [
	'forum/topic/fork',
	'forum/topic/move',
	'forum/topic/delete-posts',
	'components',
	'translator'
], function(fork, move, deletePosts, components, translator) {

	var ThreadTools = {};

	ThreadTools.init = function(tid) {

		renderMenu();

		var topicContainer = $('.topic');

		topicContainer.on('click', '[component="topic/delete"]', function() {
			topicCommand('delete', tid);
			return false;
		});

		topicContainer.on('click', '[component="topic/restore"]', function() {
			topicCommand('restore', tid);
			return false;
		});

		topicContainer.on('click', '[component="topic/purge"]', function() {
			topicCommand('purge', tid);
			return false;
		});

		topicContainer.on('click', '[component="topic/lock"]', function() {
			socket.emit('topics.lock', {tids: [tid], cid: ajaxify.data.cid});
			return false;
		});

		topicContainer.on('click', '[component="topic/unlock"]', function() {
			socket.emit('topics.unlock', {tids: [tid], cid: ajaxify.data.cid});
			return false;
		});

		topicContainer.on('click', '[component="topic/pin"]', function() {
			socket.emit('topics.pin', {tids: [tid], cid: ajaxify.data.cid});
			return false;
		});

		topicContainer.on('click', '[component="topic/unpin"]', function() {
			socket.emit('topics.unpin', {tids: [tid], cid: ajaxify.data.cid});
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread"]', function() {
			socket.emit('topics.markUnread', tid, function(err) {
				if (err) {
					return app.alertError(err);
				}
				app.alertSuccess('[[topic:mark_unread.success]]');
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread-for-all"]', function() {
			var btn = $(this);
			socket.emit('topics.markAsUnreadForAll', [tid], function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
				btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/move"]', function() {
			move.init([tid], ajaxify.data.cid);
			return false;
		});

		deletePosts.init();
		fork.init();

		components.get('topic').on('click', '[component="topic/follow"], [component="topic/unfollow"]', follow);
		components.get('topic/follow').off('click').on('click', follow);
		components.get('topic/unfollow').off('click').on('click', follow);

		function follow() {
			socket.emit('topics.toggleFollow', tid, function(err, state) {
				if (err) {
					return app.alert({
						type: 'danger',
						alert_id: 'topic_follow',
						title: '[[global:please_log_in]]',
						message: '[[topic:login_to_subscribe]]',
						timeout: 5000
					});
				}

				setFollowState(state);

				app.alert({
					alert_id: 'follow_thread',
					message: state ? '[[topic:following_topic.message]]' : '[[topic:not_following_topic.message]]',
					type: 'success',
					timeout: 5000
				});
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

			socket.emit('topics.loadTopicTools', {tid: ajaxify.data.tid, cid: ajaxify.data.cid}, function(err, data) {
				if (err) {
					return app.alertError(err);
				}

				templates.parse('partials/topic/topic-menu-list', data, function(html) {
					translator.translate(html, function(html) {
						dropdownMenu.html(html);
						$(window).trigger('action:topic.tools.load');
					});
				});
			});
		});
	}

	function topicCommand(command, tid) {
		translator.translate('[[topic:thread_tools.' + command + '_confirm]]', function(msg) {
			bootbox.confirm(msg, function(confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('topics.' + command, {tids: [tid], cid: ajaxify.data.cid}, function(err) {
					if (err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	ThreadTools.setLockedState = function(data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		var isLocked = data.isLocked && !app.user.isAdmin;

		components.get('topic/lock').toggleClass('hidden', data.isLocked);
		components.get('topic/unlock').toggleClass('hidden', !data.isLocked);
		components.get('topic/reply').toggleClass('hidden', isLocked);
		components.get('topic/reply/locked').toggleClass('hidden', !isLocked);

		threadEl.find('[component="post/reply"], [component="post/quote"], [component="post/edit"], [component="post/delete"]').toggleClass('hidden', isLocked);
		$('[component="post/header"] i.fa-lock').toggleClass('hidden', !data.isLocked);
	};

	ThreadTools.setDeleteState = function(data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/delete').toggleClass('hidden', data.isDelete);
		components.get('topic/restore').toggleClass('hidden', !data.isDelete);
		components.get('topic/purge').toggleClass('hidden', !data.isDelete);
		components.get('topic/deleted/message').toggleClass('hidden', !data.isDelete);

		threadEl.toggleClass('deleted', data.isDelete);
	};

	ThreadTools.setPinnedState = function(data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/pin').toggleClass('hidden', data.isPinned);
		components.get('topic/unpin').toggleClass('hidden', !data.isPinned);
		$('[component="post/header"] i.fa-thumb-tack').toggleClass('hidden', !data.isPinned);
	};

	function setFollowState(state) {
		components.get('topic/follow').toggleClass('hidden', state);
		components.get('topic/unfollow').toggleClass('hidden', !state);
	}


	return ThreadTools;
});
