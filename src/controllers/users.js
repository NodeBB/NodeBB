"use strict";

var usersController = {};

var async = require('async'),
	validator = require('validator'),

	user = require('../user'),
	meta = require('../meta'),
	categories = require('../categories'),
	topics = require('../topics'),
	pagination = require('../pagination'),
	plugins = require('../plugins'),
	db = require('../database'),
	helpers = require('./helpers');

usersController.getOnlineUsers = function(req, res, next) {
	var	websockets = require('../socket.io');

	async.parallel({
		users: function(next) {
			user.getUsersFromSet('users:online', req.uid, 0, 49, next);
		},
		count: function(next) {
			var now = Date.now();
			db.sortedSetCount('users:online', now - 300000, now, next);
		},
		isAdministrator: function(next) {
			user.isAdministrator(req.uid, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		if (!results.isAdministrator) {
			results.users = results.users.filter(function(user) {
				return user && user.status !== 'offline';
			});
		}

		var userData = {
			'route_users:online': true,
			search_display: 'hidden',
			loadmore_display: results.count > 50 ? 'block' : 'hide',
			users: results.users,
			anonymousUserCount: websockets.getOnlineAnonCount(),
			title: '[[pages:users/online]]',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[global:users]]', url: '/users'}, {text: '[[global:online]]'}])
		};

		render(req, res, userData, next);
	});
};

usersController.getUsersSortedByPosts = function(req, res, next) {
	usersController.getUsers('users:postcount', 0, 49, req, res, next);
};

usersController.getUsersSortedByReputation = function(req, res, next) {
	if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
		return next();
	}
	usersController.getUsers('users:reputation', 0, 49, req, res, next);
};

usersController.getUsersSortedByJoinDate = function(req, res, next) {
	usersController.getUsers('users:joindate', 0, 49, req, res, next);
};

usersController.getUsers = function(set, start, stop, req, res, next) {
	var setToTitles = {
		'users:postcount': '[[pages:users/sort-posts]]',
		'users:reputation': '[[pages:users/sort-reputation]]',
		'users:joindate': '[[pages:users/latest]]'
	};

	var setToCrumbs = {
		'users:postcount': '[[users:top_posters]]',
		'users:reputation': '[[users:most_reputation]]',
		'users:joindate': '[[global:users]]'
	};

	var breadcrumbs = [{text: setToCrumbs[set]}];

	if (set !== 'users:joindate') {
		breadcrumbs.unshift({text: '[[global:users]]', url: '/users'});
	}

	usersController.getUsersAndCount(set, req.uid, start, stop, function(err, data) {
		if (err) {
			return next(err);
		}

		var pageCount = Math.ceil(data.count / (parseInt(meta.config.userSearchResultsPerPage, 10) || 20));
		var userData = {
			search_display: 'hidden',
			loadmore_display: data.count > (stop - start + 1) ? 'block' : 'hide',
			users: data.users,
			pagination: pagination.create(1, pageCount),
			title: setToTitles[set] || '[[pages:users/latest]]',
			breadcrumbs: helpers.buildBreadcrumbs(breadcrumbs)
		};
		userData['route_' + set] = true;
		render(req, res, userData, next);
	});
};

usersController.getUsersAndCount = function(set, uid, start, stop, callback) {
	async.parallel({
		users: function(next) {
			user.getUsersFromSet(set, uid, start, stop, next);
		},
		count: function(next) {
			db.getObjectField('global', 'userCount', next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}
		results.users = results.users.filter(function(user) {
			return user && parseInt(user.uid, 10);
		});

		callback(null, results);
	});
};

usersController.getUsersForSearch = function(req, res, next) {
	if (!req.uid && parseInt(meta.config.allowGuestUserSearching, 10) !== 1) {
		return helpers.notAllowed(req, res);
	}
	var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;

	usersController.getUsersAndCount('users:joindate', req.uid, 0, resultsPerPage - 1, function(err, data) {
		if (err) {
			return next(err);
		}

		var userData = {
			search_display: 'block',
			loadmore_display: 'hidden',
			users: data.users,
			title: '[[pages:users/search]]',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[global:users]]', url: '/users'}, {text: '[[global:search]]'}])
		};

		render(req, res, userData, next);
	});
};

usersController.getMap = function(req, res, next) {
	var socketIO = require('../socket.io');
	var rooms = require('../socket.io/rooms');

	var roomNames = ['user_list', 'categories', 'unread_topics', 'recent_topics', 'popular_topics', 'tags'];
	var links = {
		user_list: '/users',
		categories: '/categories',
		unread_topics: '/unread',
		recent_topics: '/recent',
		popular_topics: '/popular',
		tags: '/tags'
	};

	var keys = Object.keys(rooms.roomClients());

	keys = keys.filter(function(key) {
		return key.startsWith('topic_') || key.startsWith('category_');
	});

	roomNames = roomNames.concat(keys);

	async.map(roomNames, function(roomName, next) {
		socketIO.getUsersInRoom(0, roomName, 0, 39, function(err, data) {
			if (err) {
				return next(err);
			}

			if (roomName.startsWith('category_')) {
				var cid = roomName.split('_')[1];
				categories.getCategoryFields(cid, ['slug', 'name'], function(err, categoryData) {
					if (err) {
						return next(err);
					}
					data.room = validator.escape(categoryData.name);
					data.link = '/category/' + categoryData.slug;
					data.core = false;
					next(null, data);
				});
			} else if (roomName.startsWith('topic_')) {
				var tid = roomName.split('_')[1];
				topics.getTopicFields(tid, ['slug', 'title'], function(err, topicData) {
					if (err) {
						return next(err);
					}
					data.room = validator.escape(topicData.title);
					data.link = '/topic/' + topicData.slug;
					data.core = false;
					next(null, data);
				});
			} else {
				data.core = true;
				next(null, data);
			}
		});
	}, function(err, data) {
		if (err) {
			return next(err);
		}
		data.sort(function(a, b) {
			return b.users.length - a.users.length;
		});

		data.forEach(function(room) {
			if (!room.link) {
				room.link = links[room.room];
			}
		});

		res.render('usersMap', {
			rooms: data,
			'reputation:disabled': parseInt(meta.config['reputation:disabled'], 10) === 1,
			title: '[[pages:users/map]]',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[global:users]]', url: '/users'}, {text: '[[global:map]]'}])
		});
	});
};

function render(req, res, data, next) {
	plugins.fireHook('filter:users.build', {req: req, res: res, templateData: data}, function(err, data) {
		if (err) {
			return next(err);
		}

		data.templateData.inviteOnly = meta.config.registrationType === 'invite-only';
		data.templateData['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;
		res.render('users', data.templateData);
	});
}



module.exports = usersController;
