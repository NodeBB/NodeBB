'use strict';

/* globals define, app, translator, socket, bootbox */

define(['forum/topic/fork', 'forum/topic/move'], function(fork, move) {

	var ThreadTools = {};

	ThreadTools.init = function(tid, threadState) {

		$('.thread-tools').removeClass('hide');

		$('.delete_thread').on('click', function(e) {
			var command = threadState.deleted !== '1' ? 'delete' : 'restore';

			bootbox.confirm('Are you sure you want to ' + command + ' this thread?', function(confirm) {
				if (confirm) {
					socket.emit('topics.' + command, tid);
				}
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
	};


	return ThreadTools;
});