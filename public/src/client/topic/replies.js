'use strict';

/* globals define, app, ajaxify, bootbox, socket, templates, utils, config */

define('forum/topic/replies', ['navigator', 'components', 'translator'], function (navigator, components, translator) {

	var Replies = {};

	Replies.init = function (tid) {
		addPostHandlers(tid);
	};

	function addPostHandlers(tid) {
		var postContainer = components.get('topic');

		postContainer.on('click', '[component="post/reply-count"]', function () {
			onRepliesClicked($(this), tid);
		});
	}

	function onRepliesClicked(button, tid) {
		var post = button.parents('[data-pid]');
		var pid = post.data('pid');
		var open = button.children('[component="post/replies/open"]');
		var loading = button.children('[component="post/replies/loading"]');
		var close = button.children('[component="post/replies/close"]');

		if (open.is(':not(.hidden)')) {
			open.addClass('hidden');
			loading.removeClass('hidden');

			socket.emit('posts.getReplies', pid, function (err, data) {
				if (err) {
					loading.addClass('hidden');
					open.removeClass('hidden');

					return app.alertError(err.message);
				}

				loading.addClass('hidden');
				close.removeClass('hidden');

				templates.parse('partials/posts_list', data, function (html) {
					translator.translate(html, function (translated) {
						$('<div>', {component: 'post/replies'}).html(translated).hide().insertAfter(button).slideDown('fast');
					});
				});
			});
		} else if (close.is(':not(.hidden)')) {
			close.addClass('hidden');
			open.removeClass('hidden');

			post.find('[component="post/replies"]').slideUp('fast', function () {
				$(this).remove();
			});
		}
	}

	return Replies;
});
