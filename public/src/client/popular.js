'use strict';

/* globals define, app, socket*/

define('forum/popular', function() {
	var Popular = {};

	Popular.init = function() {
		app.enterRoom('popular_topics');

		$('.nav-pills li').removeClass('active').find('a[href="' + window.location.pathname + '"]').parent().addClass('active');
	};

	return Popular;
});
