'use strict';


define('forum/account/upvoted', ['forum/account/header', 'forum/account/posts'], function (header, posts) {
	var Upvoted = {};

	Upvoted.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');

		posts.handleInfiniteScroll('posts.loadMoreUpVotedPosts', 'account/upvoted');
	};

	return Upvoted;
});
