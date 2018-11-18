'use strict';


define('forum/topic/replies', ['navigator', 'components', 'forum/topic/posts'], function (navigator, components, posts) {
	var Replies = {};

	Replies.init = function (button) {
		var post = button.closest('[data-pid]');
		var pid = post.data('pid');
		var open = button.find('[component="post/replies/open"]');
		var loading = button.find('[component="post/replies/loading"]');
		var close = button.find('[component="post/replies/close"]');

		if (open.is(':not(.hidden)') && loading.is('.hidden')) {
			open.addClass('hidden');
			loading.removeClass('hidden');

			socket.emit('posts.getReplies', pid, function (err, data) {
				loading.addClass('hidden');
				if (err) {
					open.removeClass('hidden');
					return app.alertError(err.message);
				}

				close.removeClass('hidden');

				posts.modifyPostsByPrivileges(data);
				var tplData = {
					posts: data,
					privileges: ajaxify.data.privileges,
					'downvote:disabled': ajaxify.data['downvote:disabled'],
					'reputation:disabled': ajaxify.data['reputation:disabled'],
					loggedIn: !!app.user.uid,
					hideReplies: true,
				};
				app.parseAndTranslate('topic', 'posts', tplData, function (html) {
					$('<div>', { component: 'post/replies' }).html(html).hide().insertAfter(button)
						.slideDown('fast');
					posts.onNewPostsAddedToDom(html);
					$(window).trigger('action:posts.loaded', { posts: data });
				});
			});
		} else if (close.is(':not(.hidden)')) {
			close.addClass('hidden');
			open.removeClass('hidden');
			loading.addClass('hidden');
			post.find('[component="post/replies"]').slideUp('fast', function () {
				$(this).remove();
			});
		}
	};

	Replies.onNewPost = function (data) {
		var post = data.posts[0];
		if (!post) {
			return;
		}
		incrementCount(post, 1);
		data.hideReplies = true;
		app.parseAndTranslate('topic', 'posts', data, function (html) {
			var replies = $('[component="post"][data-pid="' + post.toPid + '"] [component="post/replies"]').first();
			if (replies.length) {
				replies.append(html);
				posts.onNewPostsAddedToDom(html);
			}
		});
	};

	Replies.onPostPurged = function (post) {
		incrementCount(post, -1);
	};

	function incrementCount(post, inc) {
		var replyCount = $('[component="post"][data-pid="' + post.toPid + '"]').find('[component="post/reply-count"]').first();
		var countEl = replyCount.find('[component="post/reply-count/text"]');
		var avatars = replyCount.find('[component="post/reply-count/avatars"]');
		var count = Math.max(0, parseInt(countEl.attr('data-replies'), 10) + inc);
		var timestamp = replyCount.find('.timeago').attr('title', post.timestampISO);

		countEl.attr('data-replies', count);
		replyCount.toggleClass('hidden', count <= 0);
		if (count > 1) {
			countEl.translateText('[[topic:replies_to_this_post, ' + count + ']]');
		} else {
			countEl.translateText('[[topic:one_reply_to_this_post]]');
		}

		if (!avatars.find('[data-uid="' + post.uid + '"]').length && count < 7) {
			app.parseAndTranslate('topic', 'posts', { posts: [{ replies: { users: [post.user] } }] }, function (html) {
				avatars.prepend(html.find('[component="post/reply-count/avatars"] [component="user/picture"]'));
			});
		}

		avatars.addClass('hasMore');

		timestamp.data('timeago', null).timeago();
	}

	return Replies;
});
