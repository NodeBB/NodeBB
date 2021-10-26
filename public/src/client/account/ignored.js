'use strict';

define('forum/account/ignored', ['forum/account/header', 'forum/account/topics'], function (header, topics) {
	const AccountIgnored = {};

	AccountIgnored.init = function () {
		header.init();

		topics.handleInfiniteScroll('account/ignored');
	};

	return AccountIgnored;
});
