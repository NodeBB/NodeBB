'use strict';

define('forum/tag', ['topicList', 'forum/infinitescroll'], function (topicList) {
	const Tag = {};

	Tag.init = function () {
		app.enterRoom('tags');

		topicList.init('tag');
	};

	return Tag;
});
