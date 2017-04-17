'use strict';


define('forum/account/watched', ['forum/account/header', 'forum/account/topics'], function (header, topics) {
	var AccountWatched = {};

	AccountWatched.init = function () {
		header.init();

		topics.handleInfiniteScroll('account/watched', 'uid:' + ajaxify.data.theirid + ':followed_tids');
	};

	return AccountWatched;
});
