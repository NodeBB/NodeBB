'use strict';

/* globals define, app, translator, ajaxify, socket, bootbox */

define(['forum/topic/fork', 'forum/topic/move'], function(fork, move) {

	var ThreadTools = {};

	ThreadTools.init = function(tid, threadState) {

		if (ajaxify.variables.get('expose_tools') === '1') {

			$('.thread-tools').removeClass('hide');

			$('.delete_thread').on('click', function(e) {
				var command = threadState.deleted !== '1' ? 'delete' : 'restore';

				translator.translate('[[topic:thread_tools.' + command + '_confirm]]', function(msg) {
					bootbox.confirm(msg, function(confirm) {
						if (confirm) {
							socket.emit('topics.' + command, tid);
						}
					});
				});

				return false;
			});

			$('.lock_thread').on('click', function(e) {
				socket.emit(threadState.locked !== '1' ? 'topics.lock' : 'topics.unlock', tid);
				return false;
			});

			$('.pin_thread').on('click', function(e) {
				socket.emit(threadState.pinned !== '1' ? 'topics.pin' : 'topics.unpin', tid);
				return false;
			});

			$('.markAsUnreadForAll').on('click', function() {
				var btn = $(this);
				socket.emit('topics.markAsUnreadForAll', tid, function(err) {
					if(err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
					btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
				});
				return false;
			});

			move.init(tid);

			fork.init();
		}

		socket.emit('topics.followCheck', tid, function(err, state) {
			setFollowState(state, false);
		});

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

				setFollowState(state, true);
			});

			return false;
		});

	};

	function setFollowState(state, alert) {

		$('.posts .follow').toggleClass('btn-success', state).attr('title', state ? 'You are currently receiving updates to this topic' : 'Be notified of new replies in this topic');

		if(alert) {
			app.alert({
				alert_id: 'topic_follow',
				timeout: 2500,
				title: state ? '[[topic:following_topic.title]]' : '[[topic:not_following_topic.title]]',
				message: state ? '[[topic:following_topic.message]]' : '[[topic:not_following_topic.message]]',
				type: 'success'
			});
		}
	}


	return ThreadTools;
});
