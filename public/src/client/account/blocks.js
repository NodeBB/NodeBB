'use strict';

define('forum/account/blocks', ['forum/account/header'], function (header) {
	var Blocks = {};

	Blocks.init = function () {
		header.init();

		console.log('derpp');
	};

	return Blocks;
});
