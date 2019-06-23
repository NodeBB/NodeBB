'use strict';

define('forum/recent', ['topicList'], function (topicList) {
	var	Recent = {};

	Recent.init = function () {
		app.enterRoom('recent_topics');

		topicList.init('recent');
		$('#new_topic').removeAttr('data-toggle');
		$('#new_topic span.caret').remove();
	};

	return Recent;
});
