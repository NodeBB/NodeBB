'use strict';


define('forum/account/downvoted', ['forum/account/header', 'forum/account/posts'], function (header, posts) {
	var Downvoted = {};

	Downvoted.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');

		posts.handleInfiniteScroll('posts.loadMoreDownVotedPosts', 'account/downvoted');
	};

	return Downvoted;
});
