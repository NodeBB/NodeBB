'use strict';

/* globals define, app, socket*/

define('forum/popular', ['components'], function(components) {
	var Popular = {};

	Popular.init = function() {
		app.enterRoom('popular_topics');

		components.get('popular/tab')
			.removeClass('active')
			.find('a[href="' + window.location.pathname + '"]')
			.parent().addClass('active');
	};

	return Popular;
});
