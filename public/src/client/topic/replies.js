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
		var icon = button.children('.fa');

		if (icon.is('.fa-plus')) {
			icon.removeClass('fa-plus').addClass('fa-spin fa-spinner');
			socket.emit('posts.getReplies', pid, function (err, data) {
				if (err) {
					icon.removeClass('fa-spin fa-spinner').addClass('fa-plus');
					return app.alertError(err.message);
				}

				icon.removeClass('fa-spin fa-spinner').addClass('fa-minus');

				templates.parse('partials/posts_list', data, function (html) {
					translator.translate(html, function (translated) {
						$('<div>', {component: 'post/replies'}).html(translated).hide().insertAfter(button).slideDown('fast');
					});
				});
			});
		} else if (icon.is('.fa-minus')) {
			icon.removeClass('fa-minus').addClass('fa-plus');

			post.find('[component="post/replies"]').slideUp('fast', function () {
				$(this).remove();
			});
		}
	}

	return Replies;
});
