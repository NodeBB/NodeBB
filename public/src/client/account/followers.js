'use strict';


define('forum/account/followers', ['forum/account/header'], function (header) {
	const Followers = {};

	Followers.init = function () {
		header.init();
	};

	return Followers;
});
