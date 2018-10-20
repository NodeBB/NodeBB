'use strict';

define('forum/top', ['forum/recent', 'forum/infinitescroll'], function (recent, infinitescroll) {
	var	Top = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			recent.removeListeners();
		}
	});

	Top.init = function () {
		app.enterRoom('top_topics');

		recent.watchForNewPosts();

		recent.handleCategorySelection();

		$('#new-topics-alert').on('click', function () {
			$(this).addClass('hide');
		});

		if (!config.usePagination) {
			infinitescroll.init(loadMoreTopics);
		}

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });
	};

	function loadMoreTopics(direction) {
		if (direction < 0 || !$('[component="category"]').length) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreTopTopics', {
			after: $('[component="category"]').attr('data-nextstart'),
			count: config.topicsPerPage,
			cid: utils.params().cid,
			term: ajaxify.data.selectedTerm.term,
			filter: ajaxify.data.selectedFilter.filter,
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				recent.onTopicsLoaded('top', data.topics, true, direction, done);
				$('[component="category"]').attr('data-nextstart', data.nextStart);
			} else {
				done();
				$('#load-more-btn').hide();
			}
		});
	}

	return Top;
});
