'use strict';


define('forum/popular', ['topicList'], function (topicList) {
	var Popular = {};

	Popular.init = function () {
		app.enterRoom('popular_topics');

		topicList.init('popular');
	};

	return Popular;
});
