"use strict";

var usersController = {};

var async = require('async'),
	user = require('../user'),
	meta = require('../meta'),
	pagination = require('../pagination'),
	plugins = require('../plugins'),
	db = require('../database');

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

		var anonymousUserCount = websockets.getOnlineAnonCount();

		var userData = {
			search_display: 'hidden',
			loadmore_display: results.count > 50 ? 'block' : 'hide',
			users: results.users,
			anonymousUserCount: anonymousUserCount,
			show_anon: anonymousUserCount ? '' : 'hide'
		};

		res.render('users', userData);
	});
};

usersController.getUsersSortedByPosts = function(req, res, next) {
	usersController.getUsers('users:postcount', 50, req, res, next);
};

usersController.getUsersSortedByReputation = function(req, res, next) {
	usersController.getUsers('users:reputation', 50, req, res, next);
};

usersController.getUsersSortedByJoinDate = function(req, res, next) {
	usersController.getUsers('users:joindate', 50, req, res, next);
};

usersController.getUsers = function(set, count, req, res, next) {
	getUsersAndCount(set, req.uid, count, function(err, data) {
		if (err) {
			return next(err);
		}
		var pageCount = Math.ceil(data.count / (parseInt(meta.config.userSearchResultsPerPage, 10) || 20));
		var userData = {
			search_display: 'hidden',
			loadmore_display: data.count > count ? 'block' : 'hide',
			users: data.users,
			show_anon: 'hide',
			pagination: pagination.create(1, pageCount)
		};

		res.render('users', userData);
	});
};

function getUsersAndCount(set, uid, count, callback) {
	async.parallel({
		users: function(next) {
			user.getUsersFromSet(set, uid, 0, count - 1, next);
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
}

usersController.getUsersForSearch = function(req, res, next) {
	var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;

	getUsersAndCount('users:joindate', req.uid, resultsPerPage, function(err, data) {
		if (err) {
			return next(err);
		}

		var userData = {
			search_display: 'block',
			loadmore_display: 'hidden',
			users: data.users,
			show_anon: 'hide'
		};

		res.render('users', userData);
	});
};



module.exports = usersController;
