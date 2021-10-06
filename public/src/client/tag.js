'use strict';

define('forum/tag', ['topicList', 'forum/infinitescroll'], function (topicList) {
	var Tag = {};

	Tag.init = function () {
		app.enterRoom('tags');

		topicList.init('tag');
	};

	return Tag;
});
