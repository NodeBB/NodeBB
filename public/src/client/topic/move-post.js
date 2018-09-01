'use strict';


define('forum/topic/move-post', ['components', 'postSelect'], function (components, postSelect) {
	var MovePost = {};

	var moveModal;
	var moveCommit;

	MovePost.init = function () {
		$('.topic').on('click', '[component="topic/move-posts"]', onMovePostsClicked);
		$(window).on('action:ajaxify.start', onAjaxifyStart);
	};

	function onAjaxifyStart() {
		closeMoveModal();
		$(window).off('action:ajaxify.start', onAjaxifyStart);
	}

	function onMovePostsClicked() {
		MovePost.openMovePostModal();
	}

	function showPostsSelected() {
		if (postSelect.pids.length) {
			moveModal.find('#pids').translateHtml('[[topic:fork_pid_count, ' + postSelect.pids.length + ']]');
		} else {
			moveModal.find('#pids').translateHtml('[[topic:fork_no_pids]]');
		}
	}

	function checkMoveButtonEnable() {
		if (moveModal.find('#topicId').val().length && postSelect.pids.length) {
			moveCommit.removeAttr('disabled');
		} else {
			moveCommit.attr('disabled', true);
		}
	}

	MovePost.openMovePostModal = function (postEl) {
		app.parseAndTranslate('partials/move_post_modal', {}, function (html) {
			moveModal = html;

			moveCommit = moveModal.find('#move_posts_confirm');

			$(document.body).append(moveModal);

			moveModal.find('.close,#move_posts_cancel').on('click', closeMoveModal);
			moveModal.find('#topicId').on('keyup', checkMoveButtonEnable);
			postSelect.init(onPostToggled);
			showPostsSelected();

			if (postEl) {
				postSelect.togglePostSelection(postEl, onPostToggled);
			}

			moveCommit.on('click', function () {
				movePosts();
			});
		});
	};

	function onPostToggled() {
		checkMoveButtonEnable();
		showPostsSelected();
	}

	function movePosts() {
		var tid = moveModal.find('#topicId').val();
		socket.emit('posts.movePosts', { pids: postSelect.pids, tid: tid }, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			postSelect.pids.forEach(function (pid) {
				components.get('post', 'pid', pid).fadeOut(500, function () {
					$(this).remove();
				});
			});

			closeMoveModal();
		});
	}

	function closeMoveModal() {
		if (moveModal) {
			moveModal.remove();
			moveModal = null;
		}

		postSelect.disable();
	}


	return MovePost;
});
