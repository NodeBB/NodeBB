'use strict';

/* globals define */

define('forum/account/followers', ['forum/account/header'], function (header) {
	var	Followers = {};

	Followers.init = function () {
		header.init();
	};

	return Followers;
});
