'use strict';


define('forum/account/topics', ['forum/account/header', 'forum/infinitescroll'], function (header, infinitescroll) {
	var AccountTopics = {};
	var set;

	AccountTopics.init = function () {
		header.init();

		AccountTopics.handleInfiniteScroll('account/topics', 'uid:' + ajaxify.data.theirid + ':topics');
	};

	AccountTopics.handleInfiniteScroll = function (_template, _set) {
		set = _set;

		if (!config.usePagination) {
			infinitescroll.init(loadMore);
		}
	};

	function loadMore(direction) {
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreFromSet', {
			set: set,
			after: $('[component="category"]').attr('data-nextstart'),
			count: config.topicsPerPage,
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				onTopicsLoaded(data.topics, done);
			} else {
				done();
			}

			$('[component="category"]').attr('data-nextstart', data.nextStart);
		});
	}

	function onTopicsLoaded(topics, callback) {
		app.parseAndTranslate('account/topics', 'topics', { topics: topics }, function (html) {
			$('[component="category"]').append(html);
			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded', { topics: topics });
			callback();
		});
	}

	return AccountTopics;
});
