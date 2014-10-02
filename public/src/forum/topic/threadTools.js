'use strict';

/* globals define, app, translator, ajaxify, socket, bootbox */

define('forum/topic/threadTools', ['forum/topic/fork', 'forum/topic/move'], function(fork, move) {

	var ThreadTools = {};

	ThreadTools.init = function(tid, threadState) {
		ThreadTools.threadState = threadState;

		if (threadState.locked) {
			ThreadTools.setLockedState({tid: tid, isLocked: true});
		}

		if (threadState.deleted) {
			ThreadTools.setDeleteState({tid: tid, isDelete: true});
		}

		if (threadState.pinned) {
			ThreadTools.setPinnedState({tid: tid, isPinned: true});
		}

		$('.delete_thread').on('click', function() {
			topicCommand(threadState.deleted ? 'restore' : 'delete', tid);
			return false;
		});

		$('.purge_thread').on('click', function() {
			topicCommand('purge', tid);
			return false;
		});

		$('.lock_thread').on('click', function() {
			socket.emit(threadState.locked ? 'topics.unlock' : 'topics.lock', {tids: [tid], cid: ajaxify.variables.get('category_id')});
			return false;
		});

		$('.pin_thread').on('click', function() {
			socket.emit(threadState.pinned ? 'topics.unpin' : 'topics.pin', {tids: [tid], cid: ajaxify.variables.get('category_id')});
			return false;
		});

		$('.markAsUnreadForAll').on('click', function() {
			var btn = $(this);
			socket.emit('topics.markAsUnreadForAll', [tid], function(err) {
				if(err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
				btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
			});
			return false;
		});

		$('.move_thread').on('click', function(e) {
			move.init([tid], ajaxify.variables.get('category_id'));
			return false;
		});

		fork.init();

		$('.posts').on('click', '.follow', function() {
			socket.emit('topics.follow', tid, function(err, state) {
				if(err) {
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
		});
	};

	function topicCommand(command, tid) {
		translator.translate('[[topic:thread_tools.' + command + '_confirm]]', function(msg) {
			bootbox.confirm(msg, function(confirm) {
				if (confirm) {
					socket.emit('topics.' + command, {tids: [tid], cid: ajaxify.variables.get('category_id')});
				}
			});
		});
	}

	ThreadTools.setLockedState = function(data) {
		var threadEl = $('#post-container');
		if (parseInt(data.tid, 10) === parseInt(threadEl.attr('data-tid'), 10)) {
			var isLocked = data.isLocked && !app.isAdmin;

			$('.lock_thread').translateHtml('<i class="fa fa-fw fa-' + (data.isLocked ? 'un': '') + 'lock"></i> [[topic:thread_tools.' + (data.isLocked ? 'un': '') + 'lock]]');

			translator.translate(isLocked ? '[[topic:locked]]' : '[[topic:reply]]', function(translated) {
				var className = isLocked ? 'fa-lock' : 'fa-reply';
				threadEl.find('.post_reply').html('<i class="fa ' + className + '"></i> ' + translated);
				$('.topic-main-buttons .post_reply').attr('disabled', isLocked).html(isLocked ? '<i class="fa fa-lock"></i> ' + translated : translated);
			});

			threadEl.find('.quote, .edit, .delete').toggleClass('hidden', isLocked);
			$('.topic-title i.fa-lock').toggleClass('hide', !data.isLocked);
			ThreadTools.threadState.locked = data.isLocked;
		}
	};

	ThreadTools.setDeleteState = function(data) {
		var threadEl = $('#post-container');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		$('.delete_thread span').translateHtml('<i class="fa fa-fw ' + (data.isDelete ? 'fa-history' : 'fa-trash-o') + '"></i> [[topic:thread_tools.' + (data.isDelete ? 'restore' : 'delete') + ']]');

		threadEl.toggleClass('deleted', data.isDelete);
		ThreadTools.threadState.deleted = data.isDelete;
		$('.purge_thread').toggleClass('hidden', !data.isDelete);

		if (data.isDelete) {
			translator.translate('[[topic:deleted_message]]', function(translated) {
				$('<div id="thread-deleted" class="alert alert-warning">' + translated + '</div>').insertBefore(threadEl);
			});
		} else {
			$('#thread-deleted').remove();
		}
	};

	ThreadTools.setPinnedState = function(data) {
		var threadEl = $('#post-container');
		if (parseInt(data.tid, 10) === parseInt(threadEl.attr('data-tid'), 10)) {
			translator.translate('<i class="fa fa-fw fa-thumb-tack"></i> [[topic:thread_tools.' + (data.isPinned ? 'unpin' : 'pin') + ']]', function(translated) {
				$('.pin_thread').html(translated);
				ThreadTools.threadState.pinned = data.isPinned;
			});
			$('.topic-title i.fa-thumb-tack').toggleClass('hide', !data.isPinned);
		}
	};

	function setFollowState(state) {
		var title = state ? '[[topic:unwatch.title]]' : '[[topic:watch.title]]';
		var iconClass = state ? 'fa fa-eye-slash' : 'fa fa-eye';
		var text = state ? '[[topic:unwatch]]' : '[[topic:watch]]';

		var followEl = $('.posts .follow');

		translator.translate(title, function(titleTranslated) {
			followEl.attr('title', titleTranslated).find('i').attr('class', iconClass);
			followEl.find('span').text(text);

			translator.translate(followEl.html(), function(translated) {
				followEl.html(translated);
			});
		});
	}


	return ThreadTools;
});
