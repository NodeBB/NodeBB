'use strict';

/* globals define, app, socket*/

define('forum/popular', ['forum/recent', 'forum/infinitescroll'], function(recent, infinitescroll) {
	var Popular = {},
		active = '';

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

		active = recent.selectActivePill();

		infinitescroll.init(loadMoreTopics);

		function loadMoreTopics(direction) {
			if(direction < 0 || !$('#topics-container').length) {
				return;
			}

			infinitescroll.loadMore('topics.loadMoreFromSet', {
				set: 'topics:' + $('.nav-pills .active a').html().toLowerCase(),
				after: $('#topics-container').attr('data-nextstart')
			}, function(data) {
				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('popular', data.topics, false);
					$('#topics-container').attr('data-nextstart', data.nextStart);
				} else {
					$('#load-more-btn').hide();
				}
			});
		}
	};

	return Popular;
});
