'use strict';


define('forum/tag', ['forum/recent', 'forum/infinitescroll'], function (recent, infinitescroll) {
	var Tag = {};

	Tag.init = function () {
		app.enterRoom('tags');

		if ($('body').height() <= $(window).height() && $('[component="category"]').children().length >= 20) {
			$('#load-more-btn').show();
		}

		$('#load-more-btn').on('click', function () {
			loadMoreTopics();
		});

		if (!config.usePagination) {
			infinitescroll.init(loadMoreTopics);
		}

		function loadMoreTopics(direction) {
			if (direction < 0 || !$('[component="category"]').length) {
				return;
			}

			infinitescroll.loadMore('topics.loadMoreFromSet', {
				set: 'tag:' + ajaxify.data.tag + ':topics',
				after: $('[component="category"]').attr('data-nextstart'),
				count: config.topicsPerPage,
			}, function (data, done) {
				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('tag', data.topics, false, direction, done);
				} else {
					done();
					$('#load-more-btn').hide();
				}
				$('[component="category"]').attr('data-nextstart', data.nextStart);
			});
		}
	};

	return Tag;
});
