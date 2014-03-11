'use strict';

define(function() {
	var	home = {};

	home.init = function() {

		app.enterRoom('home');

		ajaxify.register_events([
			'event:new_topic',
			'event:new_post'
		]);

		socket.on('event:new_topic', function(data) {

		});

		socket.on('event:new_post', function(data) {

		});
	}

	return home;
});
