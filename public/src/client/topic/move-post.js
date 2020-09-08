'use strict';


define('forum/topic/move-post', [
	'components', 'postSelect', 'translator',
], function (components, postSelect, translator) {
	var MovePost = {};

	var moveModal;
	var moveCommit;
	var fromTid;

	MovePost.init = function (postEl) {
		if (moveModal) {
			return;
		}
		fromTid = ajaxify.data.tid;
		app.parseAndTranslate('modals/move-post', {}, function (html) {
			moveModal = html;

			moveCommit = moveModal.find('#move_posts_confirm');

			$('body').append(moveModal);

			moveModal.find('.close,#move_posts_cancel').on('click', closeMoveModal);
			postSelect.init(onPostToggled);
			showPostsSelected();

			if (postEl) {
				postSelect.togglePostSelection(postEl, postEl.attr('data-pid'));
			}

			$(window).off('action:axajify.end', checkMoveButtonEnable)
				.on('action:ajaxify.end', checkMoveButtonEnable);

			moveCommit.on('click', function () {
				movePosts();
			});
		});
	};

	function showPostsSelected() {
		if (!moveModal) {
			return;
		}
		if (postSelect.pids.length) {
			if (ajaxify.data.template.topic && ajaxify.data.tid && ajaxify.data.tid !== fromTid) {
				var translateStr = translator.compile('topic:x-posts-will-be-moved-to-y', postSelect.pids.length, ajaxify.data.title);
				moveModal.find('#pids').translateHtml(translateStr);
			} else {
				moveModal.find('#pids').translateHtml('[[topic:x-posts-selected, ' + postSelect.pids.length + ']]');
			}
		} else {
			moveModal.find('#pids').translateHtml('[[topic:no-posts-selected]]');
		}
	}

	function checkMoveButtonEnable() {
		if (!moveModal) {
			return;
		}

		if (postSelect.pids.length && ajaxify.data.tid &&
			ajaxify.data.template.topic && ajaxify.data.tid !== fromTid
		) {
			moveCommit.removeAttr('disabled');
		} else {
			moveCommit.attr('disabled', true);
		}
		showPostsSelected();
	}

	function onPostToggled() {
		checkMoveButtonEnable();
	}

	function movePosts() {
		if (!ajaxify.data.template.topic || !ajaxify.data.tid) {
			return;
		}
		socket.emit('posts.movePosts', { pids: postSelect.pids, tid: ajaxify.data.tid }, function (err) {
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
			postSelect.disable();
		}
	}


	return MovePost;
});
