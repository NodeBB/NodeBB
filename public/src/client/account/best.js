'use strict';


define('forum/account/best', ['forum/account/header', 'forum/account/posts'], function (header, posts) {
	const Best = {};

	Best.init = function () {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');

		posts.handleInfiniteScroll('account/best');
	};

	return Best;
});
