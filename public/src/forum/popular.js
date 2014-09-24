'use strict';

/* globals define, app, socket*/

define('forum/popular', ['forum/recent', 'forum/infinitescroll'], function(recent, infinitescroll) {
	var Popular = {};

	Popular.init = function() {
		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		recent.selectActivePill();
	};

	return Popular;
});
