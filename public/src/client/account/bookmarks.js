'use strict';


define('forum/account/bookmarks', ['forum/account/header', 'forum/account/posts'], function (header, posts) {
	const Bookmarks = {};

	Bookmarks.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');

		posts.handleInfiniteScroll('account/bookmarks');
	};

	return Bookmarks;
});
