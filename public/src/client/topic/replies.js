'use strict';



define('forum/topic/replies', ['navigator', 'components', 'forum/topic/posts'], function (navigator, components, posts) {

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
		var post = button.closest('[data-pid]');
		var pid = post.data('pid');
		var open = button.children('[component="post/replies/open"]');
		var loading = button.children('[component="post/replies/loading"]');
		var close = button.children('[component="post/replies/close"]');

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
					$('<div>', {component: 'post/replies'}).html(html).hide().insertAfter(button).slideDown('fast');
					posts.processPage(html);
					$(window).trigger('action:posts.loaded', {posts: data});
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
	}

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
				posts.processPage(html);
			}
		});
	};

	Replies.onPostPurged = function (post) {
		incrementCount(post, -1);
	};

	function incrementCount(post, inc) {
		var replyCount = $('[component="post"][data-pid="' + post.toPid + '"]').find('[component="post/reply-count"]').first();
		var countEl = replyCount.find('[component="post/reply-count/text"]');
		var count = Math.max(0, parseInt(countEl.attr('data-replies'), 10) + inc);
		countEl.attr('data-replies', count);
		replyCount.toggleClass('hidden', !count);
		countEl.translateText('[[topic:replies_to_this_post, ' + count + ']]');
	}

	return Replies;
});
