'use strict';


define('forum/topic/move-post', [], function () {

	var MovePost = {};


	MovePost.openMovePostModal = function (button) {
		app.parseAndTranslate('partials/move_post_modal', {}, function (html) {
			var moveModal = $(html);

			var	moveBtn = moveModal.find('#move_post_commit');
			var topicId = moveModal.find('#topicId');

			moveModal.on('hidden.bs.modal', function () {
				moveModal.remove();
			});

			showMoveModal(moveModal);

			moveModal.find('.close, #move_post_cancel').on('click', function () {
				moveModal.addClass('hide');
			});

			topicId.on('keyup change', function () {
				moveBtn.attr('disabled', !topicId.val());
			});

			moveBtn.on('click', function () {
				movePost(button.parents('[data-pid]'), button.parents('[data-pid]').attr('data-pid'), topicId.val(), function () {
					moveModal.modal('hide');
					topicId.val('');
				});
			});

		});
	};

	function showMoveModal(modal) {
		modal.modal('show')
			.css("position", "fixed")
			.css("left", Math.max(0, (($(window).width() - modal.outerWidth()) / 2) + $(window).scrollLeft()) + "px")
			.css("top", "0px")
			.css("z-index", "2000");
	}

	function movePost(post, pid, tid, callback) {
		socket.emit('posts.movePost', {pid: pid, tid: tid}, function (err) {
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
