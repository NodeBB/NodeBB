'use strict';

define(function() {
	var	home = {};

	$(window).on('action:ajaxify.end', function(ev, data) {
		if (data.url === '') {
			socket.removeListener('event:new_topic', home.onNewTopic);
			socket.removeListener('event:new_post', home.onNewPost);
		}
	});


	home.init = function() {

		app.enterRoom('home');

		socket.on('event:new_topic', home.onNewTopic);
		socket.on('event:new_post', home.onNewPost);
	};

	home.onNewTopic = function(data) {

	};

	home.onNewPost = function(data) {

	};

	return home;
});
