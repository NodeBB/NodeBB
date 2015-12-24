'use strict';

/* globals define, app, ajaxify, socket, templates, translator */

define('forum/topic/delete-posts', ['components', 'postSelect'], function(components, postSelect) {

	var DeletePosts = {},
		modal,
		deleteBtn,
		purgeBtn;

	DeletePosts.init = function() {
		$('.topic').on('click', '[component="topic/delete/posts"]', onDeletePostsClicked);
	};

	function onDeletePostsClicked() {
		parseModal(function(html) {
			modal = $(html);

			modal.on('hidden.bs.modal', function() {
				modal.remove();
			});

			deleteBtn = modal.find('#delete_posts_confirm');
			purgeBtn = modal.find('#purge_posts_confirm');

			showModal();

			modal.find('.close,#delete_posts_cancel').on('click', closeModal);

			postSelect.init(function() {
				checkButtonEnable();
				showPostsSelected();
			});
			showPostsSelected();

			deleteBtn.on('click', function() {
				deletePosts(deleteBtn, 'posts.deletePosts');
			});
			purgeBtn.on('click', function() {
				deletePosts(purgeBtn, 'posts.purgePosts');
			});
		});
	}

	function parseModal(callback) {
		templates.parse('partials/delete_posts_modal', {}, function(html) {
			translator.translate(html, callback);
		});
	}

	function showModal() {
		modal.modal({backdrop: false, show: true})
			.css('position', 'fixed')
			.css('left', Math.max(0, (($(window).width() - modal.outerWidth()) / 2) + $(window).scrollLeft()) + 'px')
			.css('top', '0px')
			.css('z-index', '2000');
	}

	function deletePosts(btn, command) {
		btn.attr('disabled', true);
		socket.emit(command, {
			tid: ajaxify.data.tid,
			pids: postSelect.pids
		}, function(err) {
			btn.removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}

			closeModal();
		});
	}

	function showPostsSelected() {
		if (postSelect.pids.length) {
			modal.find('#pids').text(postSelect.pids.join(', '));
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
		postSelect.pids.forEach(function(pid) {
			components.get('post', 'pid', pid).css('opacity', 1);
		});

		modal.modal('hide');

		components.get('topic').off('click', '[data-pid]');
		postSelect.enableClicksOnPosts();
	}

	return DeletePosts;
});
