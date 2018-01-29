'use strict';


define('forum/popular', ['forum/recent', 'components', 'forum/infinitescroll'], function (recent, components, infinitescroll) {
	var Popular = {};

	Popular.init = function () {
		app.enterRoom('popular_topics');

		components.get('popular/tab')
			.removeClass('active')
			.find('a[href="' + window.location.pathname + '"]')
			.parent().addClass('active');

		if (!config.usePagination) {
			infinitescroll.init(loadMoreTopics);
		}
	};

	function loadMoreTopics(direction) {
		if (direction < 0 || !$('[component="category"]').length) {
			return;
		}

		infinitescroll.loadMore('topics.loadMorePopularTopics', {
			after: $('[component="category"]').attr('data-nextstart'),
			count: config.topicsPerPage,
			term: ajaxify.data.term,
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				recent.onTopicsLoaded('popular', data.topics, false, done);
				$('[component="category"]').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}
		});
	}

	return Popular;
});
