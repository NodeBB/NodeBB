'use strict';

define('forum/top', ['topicList'], function (topicList) {
	var	Top = {};

	Top.init = function () {
		app.enterRoom('top_topics');

		topicList.init('top');
	};

	return Top;
});
