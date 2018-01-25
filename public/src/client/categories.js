'use strict';


define('forum/categories', ['components'], function (components) {
	var	categories = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			socket.removeListener('event:new_post', categories.onNewPost);
		}
	});

	categories.init = function () {
		app.enterRoom('categories');

		socket.removeListener('event:new_post', categories.onNewPost);
		socket.on('event:new_post', categories.onNewPost);

		$('.category-header').tooltip({
			placement: 'bottom',
		});
	};

	categories.onNewPost = function (data) {
		if (data && data.posts && data.posts.length && data.posts[0].topic) {
			renderNewPost(data.posts[0].topic.cid, data.posts[0]);
		}
	};

	function renderNewPost(cid, post) {
		var category = components.get('categories/category', 'cid', cid);
		var numRecentReplies = category.attr('data-numRecentReplies');
		if (!numRecentReplies || !parseInt(numRecentReplies, 10)) {
			return;
		}

		var recentPosts = category.find('[component="category/posts"]');

		app.parseAndTranslate('partials/categories/lastpost', 'posts', { posts: [post] }, function (html) {
			html.find('.post-content img:not(.not-responsive)').addClass('img-responsive');
			html.hide();
			if (recentPosts.length === 0) {
				html.appendTo(category);
			} else {
				html.insertBefore(recentPosts.first());
			}

			html.fadeIn();

			app.createUserTooltips();
			html.find('.timeago').timeago();

			if (category.find('[component="category/posts"]').length > parseInt(numRecentReplies, 10)) {
				recentPosts.last().remove();
			}

			$(window).trigger('action:posts.loaded', { posts: [post] });
		});
	}

	return categories;
});
