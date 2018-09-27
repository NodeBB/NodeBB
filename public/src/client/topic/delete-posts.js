'use strict';


define('forum/topic/delete-posts', ['components', 'postSelect'], function (components, postSelect) {
	var DeletePosts = {};
	var modal;
	var deleteBtn;
	var purgeBtn;

	DeletePosts.init = function () {
		$('.topic').on('click', '[component="topic/delete/posts"]', onDeletePostsClicked);
		$(window).on('action:ajaxify.start', onAjaxifyStart);
	};

	function onAjaxifyStart() {
		closeModal();
		$(window).off('action:ajaxify.start', onAjaxifyStart);
	}

	function onDeletePostsClicked() {
		if (modal) {
			return;
		}

		app.parseAndTranslate('partials/delete_posts_modal', {}, function (html) {
			modal = html;

			$('body').append(modal);

			deleteBtn = modal.find('#delete_posts_confirm');
			purgeBtn = modal.find('#purge_posts_confirm');

			modal.find('.close,#delete_posts_cancel').on('click', closeModal);

			postSelect.init(function () {
				checkButtonEnable();
				showPostsSelected();
			});
			showPostsSelected();

			deleteBtn.on('click', function () {
				deletePosts(deleteBtn, 'posts.deletePosts');
			});
			purgeBtn.on('click', function () {
				deletePosts(purgeBtn, 'posts.purgePosts');
			});
		});
	}

	function deletePosts(btn, command) {
		btn.attr('disabled', true);
		socket.emit(command, {
			tid: ajaxify.data.tid,
			pids: postSelect.pids,
		}, function (err) {
			btn.removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}

			closeModal();
		});
	}

	function showPostsSelected() {
		if (postSelect.pids.length) {
			modal.find('#pids').translateHtml('[[topic:fork_pid_count, ' + postSelect.pids.length + ']]');
		} else {
			modal.find('#pids').translateHtml('[[topic:fork_no_pids]]');
		}
	}

	function checkButtonEnable() {
		if (postSelect.pids.length) {
			deleteBtn.removeAttr('disabled');
			purgeBtn.removeAttr('disabled');
		} else {
			deleteBtn.attr('disabled', true);
			purgeBtn.attr('disabled', true);
		}
	}

	function closeModal() {
		if (modal) {
			modal.remove();
			modal = null;
		}
		postSelect.disable();
	}

	return DeletePosts;
});
