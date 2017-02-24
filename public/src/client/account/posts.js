'use strict';


define('forum/account/posts', ['forum/account/header', 'forum/infinitescroll'], function (header, infinitescroll) {
	var AccountPosts = {};
	var method;
	var template;

	AccountPosts.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');

		AccountPosts.handleInfiniteScroll('posts.loadMoreUserPosts', 'account/posts');
	};

	AccountPosts.handleInfiniteScroll = function (_method, _template) {
		method = _method;
		template = _template;
		if (!config.usePagination) {
			infinitescroll.init(loadMore);
		}
	};

	function loadMore(direction) {
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore(method, {
			uid: ajaxify.data.theirid,
			after: $('[component="posts"]').attr('data-nextstart'),
		}, function (data, done) {
			if (data.posts && data.posts.length) {
				onPostsLoaded(data.posts, done);
			} else {
				done();
			}
			$('[component="posts"]').attr('data-nextstart', data.nextStart);
		});
	}

	function onPostsLoaded(posts, callback) {
		app.parseAndTranslate(template, 'posts', { posts: posts }, function (html) {
			$('[component="posts"]').append(html);
			html.find('img:not(.not-responsive)').addClass('img-responsive');
			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			callback();
		});
	}

	return AccountPosts;
});
