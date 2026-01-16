'use strict';


define('forum/topic/replies', ['forum/topic/posts', 'hooks', 'alerts', 'api'], function (posts, hooks, alerts, api) {
	const Replies = {};

	Replies.init = function (button) {
		const post = button.closest('[data-pid]');
		const pid = post.data('pid');
		const open = button.find('[component="post/replies/open"]');

		if (open.attr('loading') !== '1' && open.attr('loaded') !== '1') {
			open.attr('loading', '1')
				.removeClass('fa-chevron-down')
				.addClass('fa-spin fa-spinner');

			api.get(`/posts/${encodeURIComponent(pid)}/replies`, {}, function (err, { replies }) {
				const postData = replies;
				open.removeAttr('loading')
					.attr('loaded', '1')
					.removeClass('fa-spin fa-spinner')
					.addClass('fa-chevron-up');
				if (err) {
					return alerts.error(err);
				}

				postData.forEach((post, index) => {
					if (post) {
						post.index = index;
					}
				});
				posts.modifyPostsByPrivileges(postData);
				const tplData = {
					posts: postData,
					privileges: ajaxify.data.privileges,
					'downvote:disabled': ajaxify.data['downvote:disabled'],
					'reputation:disabled': ajaxify.data['reputation:disabled'],
					loggedIn: !!app.user.uid,
					hideParent: true,
					hideReplies: config.hasOwnProperty('showNestedReplies') ? !config.showNestedReplies : true,
				};
				app.parseAndTranslate('topic', 'posts', tplData, async function (html) {
					const repliesEl = $('<ul>', { component: 'post/replies', class: 'list-unstyled' }).html(html).hide();
					if (button.attr('data-target-component')) {
						post.find('[component="' + button.attr('data-target-component') + '"]').html(repliesEl);
					} else {
						repliesEl.insertAfter(button);
					}

					repliesEl.slideDown('fast');
					await posts.onNewPostsAddedToDom(html);
					hooks.fire('action:posts.loaded', { posts: postData });
				});
			});
		} else if (open.attr('loaded') === '1') {
			open.removeAttr('loaded')
				.removeAttr('loading')
				.removeClass('fa-spin fa-spinner fa-chevron-up')
				.addClass('fa-chevron-down');
			post.find('[component="post/replies"]').slideUp('fast', function () {
				$(this).remove();
			});
		}
	};

	Replies.onNewPost = function (data) {
		const post = data.posts[0];
		if (!post) {
			return;
		}
		incrementCount(post, 1);
		data.hideReplies = config.hasOwnProperty('showNestedReplies') ? !config.showNestedReplies : true;
		app.parseAndTranslate('topic', 'posts', data, async function (html) {
			const replies = $('[component="post"][data-pid="' + post.toPid + '"] [component="post/replies"]').first();
			if (replies.length) {
				if (config.topicPostSort === 'newest_to_oldest') {
					replies.prepend(html);
				} else {
					replies.append(html);
				}
				await posts.onNewPostsAddedToDom(html);
			}
		});
	};

	Replies.onPostPurged = function (post) {
		incrementCount(post, -1);
	};

	function incrementCount(post, inc) {
		const postEl = document.querySelector(`[component="post"][data-pid="${post.toPid}"]`);
		if (!postEl) {
			return;
		}

		const replyCount = $('[component="post"][data-pid="' + post.toPid + '"]').find('[component="post/reply-count"]').first();
		const countEl = replyCount.find('[component="post/reply-count/text"]');
		const avatars = replyCount.find('[component="post/reply-count/avatars"]');
		const count = Math.max(0, (parseInt(countEl.attr('data-replies'), 10) || 0) + inc);
		const timestamp = replyCount.find('.timeago').attr('title', post.timestampISO);

		const index = postEl.getAttribute('data-index');
		const hasSingleImmediateReply = count === 1 && Math.abs(post.index - index) === 1;

		countEl.attr('data-replies', count);
		replyCount.toggleClass('hidden', count <= 0 || hasSingleImmediateReply);
		if (count > 1) {
			countEl.translateText('[[topic:replies-to-this-post, ' + count + ']]');
		} else {
			countEl.translateText('[[topic:one-reply-to-this-post]]');
		}

		if (!avatars.find('[data-uid="' + post.uid + '"]').length && count < 7) {
			app.parseAndTranslate('topic', 'posts', {
				posts: [{ replies: { count: count, hasMore: false, users: [post.user] } }],
			}, function (html) {
				avatars.prepend(html.find('[component="post/reply-count/avatars"]').html());
			});
		}

		avatars.addClass('hasMore');

		timestamp.data('timeago', null).timeago();
	}

	return Replies;
});
