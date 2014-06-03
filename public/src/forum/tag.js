'use strict';

/* globals define, app, socket */

define('forum/tag', ['forum/recent', 'forum/infinitescroll'], function(recent, infinitescroll) {
	var Tag = {};

	Tag.init = function() {
		app.enterRoom('tags');

		if ($('body').height() <= $(window).height() && $('#topics-container').children().length >= 20) {
			$('#load-more-btn').show();
		}

		$('#load-more-btn').on('click', function() {
			loadMoreTopics();
		});

		infinitescroll.init(loadMoreTopics);

		function loadMoreTopics(direction) {
			if(direction < 0 || !$('#topics-container').length) {
				return;
			}

			infinitescroll.loadMore('topics.loadMoreFromSet', {
				set: 'tag:' + ajaxify.variables.get('tag') + ':topics',
				after: $('#topics-container').attr('data-nextstart')
			}, function(data, done) {
				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('tag', data.topics, false, done);
					$('#topics-container').attr('data-nextstart', data.nextStart);
				} else {
					done();
					$('#load-more-btn').hide();
				}
			});
		}
	};

	return Tag;
});
