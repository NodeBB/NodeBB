'use strict';


define('forum/popular', ['topicList'], function (topicList) {
	const Popular = {};

	Popular.init = function () {
		app.enterRoom('popular_topics');

		topicList.init('popular');
	};

	return Popular;
});
