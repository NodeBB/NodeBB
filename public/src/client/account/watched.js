'use strict';

/* globals define, app, socket, utils */
define('forum/account/watched', ['forum/account/header', 'forum/account/topics'], function(header, topics) {
	var AccountWatched = {};

	AccountWatched.init = function() {
		header.init();

		topics.handleInfiniteScroll('account/watched', 'uid:' + ajaxify.variables.get('theirid') + ':followed_tids');
	};

	return AccountWatched;
});
