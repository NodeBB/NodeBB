"use strict";

var usersController = {};

var async = require('async'),
	user = require('../user'),
	meta = require('../meta'),
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
			anonymousUserCount: websockets.getOnlineAnonCount()
		};

		render(req, res, userData, next);
	});
};

usersController.getUsersSortedByPosts = function(req, res, next) {
	usersController.getUsers('users:postcount', 0, 49, req, res, next);
};

usersController.getUsersSortedByReputation = function(req, res, next) {
	usersController.getUsers('users:reputation', 0, 49, req, res, next);
};

usersController.getUsersSortedByJoinDate = function(req, res, next) {
	usersController.getUsers('users:joindate', 0, 49, req, res, next);
};

usersController.getUsers = function(set, start, stop, req, res, next) {
	usersController.getUsersAndCount(set, req.uid, start, stop, function(err, data) {
		if (err) {
			return next(err);
		}
		var pageCount = Math.ceil(data.count / (parseInt(meta.config.userSearchResultsPerPage, 10) || 20));
		var userData = {
			search_display: 'hidden',
			loadmore_display: data.count > (stop - start + 1) ? 'block' : 'hide',
			users: data.users,
			pagination: pagination.create(1, pageCount)
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
	if (!req.uid) {
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
			users: data.users
		};

		render(req, res, userData, next);
	});
};

function render(req, res, data, next) {
	plugins.fireHook('filter:users.build', {req: req, res: res, templateData: data}, function(err, data) {
		if (err) {
			return next(err);
		}
		res.render('users', data.templateData);
	});
}



module.exports = usersController;
