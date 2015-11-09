'use strict';

/* globals define */

define('forum/account/following', ['forum/account/header', 'forum/infinitescroll', 'forum/account/followers'], function(header, infinitescroll, followers) {
	var	Following = {};

	Following.init = function() {
		header.init();

		infinitescroll.init(function(direction) {
			followers.loadMore(direction, 'account/following', 'following:' + ajaxify.data.uid);
		});
	};

	return Following;
});
