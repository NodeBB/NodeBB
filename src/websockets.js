console.log('HEY NIB, I STILL GOT CALLED');
'use strict';

var cookie = require('cookie'),




	S = require('string'),




	groups = require('./groups'),
	posts = require('./posts'),
	favourites = require('./favourites'),
	utils = require('../public/src/utils'),

	categories = require('./categories'),
	CategoryTools = require('./categoryTools'),
	notifications = require('./notifications'),
	threadTools = require('./threadTools'),
	postTools = require('./postTools'),
	Messaging = require('./messaging'),
	meta = require('./meta'),


	admin = {
		'categories': require('./admin/categories'),
		'user': require('./admin/user')
	},
	plugins = require('./plugins');

(function(websockets) {

websockets.init = function(io) {





		// BEGIN: API calls (todo: organize)












































		/*
			GROUPS
		*/

		socket.on('api:groups.create', function(data, callback) {
			groups.create(data.name, data.description, function(err, groupObj) {
				callback(err ? err.message : null, groupObj || undefined);
			});
		});

		socket.on('api:groups.delete', function(gid, callback) {
			groups.destroy(gid, function(err) {
				callback(err ? err.message : null, err ? null : 'OK');
			});
		});

		socket.on('api:groups.get', function(gid, callback) {
			groups.get(gid, {
				expand: true
			}, function(err, groupObj) {
				callback(err ? err.message : null, groupObj || undefined);
			});
		});

		socket.on('api:groups.join', function(data, callback) {
			groups.join(data.gid, data.uid, callback);
		});

		socket.on('api:groups.leave', function(data, callback) {
			groups.leave(data.gid, data.uid, callback);
		});

		socket.on('api:groups.update', function(data, callback) {
			groups.update(data.gid, data.values, function(err) {
				callback(err ? err.message : null);
			});
		});

		socket.on('api:admin.theme.set', meta.themes.set);

}



})(module.exports);
