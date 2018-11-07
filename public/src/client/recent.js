'use strict';

define('forum/recent', ['topicList'], function (topicList) {
	var	Recent = {};

	Recent.init = function () {
		app.enterRoom('recent_topics');

		topicList.init('recent');
	};

	return Recent;
});
