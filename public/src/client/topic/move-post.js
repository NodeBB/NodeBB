'use strict';


define('forum/topic/move-post', [], function () {
	var MovePost = {};

	MovePost.openMovePostModal = function (button) {
		app.parseAndTranslate('partials/move_post_modal', {}, function (html) {
			var dialog = bootbox.dialog({
				title: '[[topic:move_post]]',
				message: html,
				show: true,
				buttons: {
					submit: {
						label: '[[topic:confirm_move]]',
						className: 'btn-primary submit-btn',
						callback: function () {
							var topicIdEl = dialog.find('#topicId');
							if (!topicIdEl.val()) {
								return;
							}

							movePost(button.parents('[data-pid]'), button.parents('[data-pid]').attr('data-pid'), topicIdEl.val(), function () {
								topicIdEl.val('');
							});
						},
					},
				},
			});
			dialog.find('.submit-btn').attr('disabled', true);

			dialog.find('#topicId').on('keyup change', function () {
				dialog.find('.submit-btn').attr('disabled', !dialog.find('#topicId').val());
			});
		});
	};

	function movePost(post, pid, tid, callback) {
		socket.emit('posts.movePost', { pid: pid, tid: tid }, function (err) {
			if (err) {
				app.alertError(err.message);
				return callback();
			}

			post.fadeOut(500, function () {
				post.remove();
			});

			app.alertSuccess('[[topic:post_moved]]');
			callback();
		});
	}


	return MovePost;
});
