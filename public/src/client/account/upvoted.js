'use strict';


define('forum/account/upvoted', ['forum/account/header', 'forum/account/posts'], function (header, posts) {
	const Upvoted = {};

	Upvoted.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');

		posts.handleInfiniteScroll('account/upvoted');
	};

	return Upvoted;
});
