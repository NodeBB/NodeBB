'use strict';


define('forum/account/read', ['forum/account/header', 'forum/account/topics'], function (header, topics) {
	const AccountRead = {};

	AccountRead.init = function () {
		header.init();

		topics.handleInfiniteScroll('account/read');
	};

	return AccountRead;
});
