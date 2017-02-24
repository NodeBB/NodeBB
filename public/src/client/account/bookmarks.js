'use strict';


define('forum/account/bookmarks', ['forum/account/header', 'forum/account/posts'], function (header, posts) {
	var Bookmarks = {};

	Bookmarks.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');

		posts.handleInfiniteScroll('posts.loadMoreBookmarks', 'account/bookmarks');
	};

	return Bookmarks;
});
