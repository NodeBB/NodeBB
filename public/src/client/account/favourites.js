'use strict';

/* globals define, app, utils */

define('forum/account/favourites', ['forum/account/header', 'forum/account/posts'], function(header, posts) {
	var Favourites = {};

	Favourites.init = function() {
		header.init();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');

		posts.handleInfiniteScroll('posts.loadMoreFavourites', 'account/favourites');
	};

	return Favourites;
});
