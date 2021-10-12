'use strict';


define('forum/account/following', ['forum/account/header'], function (header) {
	const	Following = {};

	Following.init = function () {
		header.init();
	};

	return Following;
});
