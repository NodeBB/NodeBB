'use strict';

/* globals define, app, socket, utils, config, ajaxify */

define('forum/account/posts', ['forum/account/header', 'forum/infinitescroll'], function(header, infinitescroll) {
	var AccountPosts = {};
	var method, template;

	AccountPosts.init = function() {
		header.init();

		$('[component="post/content"] img').addClass('img-responsive');

		AccountPosts.handleInfiniteScroll('posts.loadMoreUserPosts', 'account/posts');
	};

	AccountPosts.handleInfiniteScroll = function(_method, _template) {
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
			uid: ajaxify.variables.get('theirid'),
			after: $('[component="posts"]').attr('data-nextstart')
		}, function(data, done) {
			if (data.posts && data.posts.length) {
				onPostsLoaded(data.posts, done);
			} else {
				done();
			}
			$('[component="posts"]').attr('data-nextstart', data.nextStart);
		});
	}

	function onPostsLoaded(posts, callback) {
		infinitescroll.parseAndTranslate(template, 'posts', {posts: posts}, function(html) {
			$('[component="posts"]').append(html);
			html.find('img').addClass('img-responsive');
			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			callback();
		});
	}

	return AccountPosts;
});
