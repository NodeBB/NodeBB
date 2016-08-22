'use strict';

/* globals define */

define('forum/account/downvoted', ['forum/account/header', 'forum/account/posts'], function(header, posts) {
	var Downvoted = {};

	Downvoted.init = function() {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');

		posts.handleInfiniteScroll('posts.loadMoreDownVotedPosts', 'account/downvoted');
	};

	return Downvoted;
});
