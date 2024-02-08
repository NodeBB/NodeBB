'use strict';

define('forum/world', ['topicList'], function (topicList) {
	const World = {};

	World.init = function () {
		app.enterRoom('world');

		topicList.init('world');
	};

	return World;
});
