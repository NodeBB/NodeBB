'use strict';


define('forum/account/following', ['forum/account/header'], function (header) {
	var	Following = {};

	Following.init = function () {
		header.init();
	};

	return Following;
});
