'use strict';

/* globals define, app, socket*/

define('forum/popular', ['forum/recent', 'forum/infinitescroll'], function(recent, infinitescroll) {
	var Popular = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if(data.url.indexOf('recent') !== 0) {
			recent.removeListeners();
		}
	});

	Popular.init = function() {
		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		recent.watchForNewPosts();

		recent.selectActivePill();
	};

	return Popular;
});
