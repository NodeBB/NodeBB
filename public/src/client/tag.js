'use strict';


define('forum/tag', ['topicList', 'forum/infinitescroll'], function (topicList, infinitescroll) {
	var Tag = {};

	Tag.init = function () {
		app.enterRoom('tags');

		topicList.init('tag', loadMoreTopics);

		function loadMoreTopics(after, direction, callback) {
			infinitescroll.loadMore('topics.loadMoreFromSet', {
				set: 'tag:' + ajaxify.data.tag + ':topics',
				after: after,
				direction: direction,
				count: config.topicsPerPage,
			}, callback);
		}
	};

	return Tag;
});
