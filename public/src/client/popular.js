'use strict';


define('forum/popular', ['forum/recent', 'components', 'forum/infinitescroll'], function (recent, components, infinitescroll) {
	var Popular = {};

	Popular.init = function () {
		app.enterRoom('popular_topics');

		recent.handleCategorySelection();

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
			cid: utils.params().cid,
			term: ajaxify.data.selectedTerm.term,
			filter: ajaxify.data.selectedFilter.filter,
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				recent.onTopicsLoaded('popular', data.topics, false, direction, done);
				$('[component="category"]').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}
		});
	}

	return Popular;
});
