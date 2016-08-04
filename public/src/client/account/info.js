'use strict';

/* globals define */

define('forum/account/info', ['forum/account/header'], function(header) {
	var Info = {};

	Info.init = function() {
		header.init();
	};

	return Info;
});
