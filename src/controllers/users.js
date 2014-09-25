"use strict";

var usersController = {};

var async = require('async'),
	user = require('../user'),
	db = require('../database');

usersController.getOnlineUsers = function(req, res, next) {
	var	websockets = require('../socket.io');
	var uid = req.user ? req.user.uid : 0;

	async.parallel({
		users: function(next) {
			user.getUsersFromSet('users:online', 0, 49, next);
		},
		count: function(next) {
			db.sortedSetCard('users:online', next);
		},
		isAdministrator: function(next) {
			user.isAdministrator(uid, next);
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
	getUsers('users:postcount', res, next);
};

usersController.getUsersSortedByReputation = function(req, res, next) {
	getUsers('users:reputation', res, next);
};

usersController.getUsersSortedByJoinDate = function(req, res, next) {
	getUsers('users:joindate', res, next);
};

function getUsers(set, res, next) {
	async.parallel({
		users: function(next) {
			user.getUsersFromSet(set, 0, 49, next);
		},
		count: function(next) {
			db.sortedSetCard(set, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		results.users = results.users.filter(function(user) {
			return user && parseInt(user.uid, 10);
		});

		var userData = {
			search_display: 'hidden',
			loadmore_display: results.count > 50 ? 'block' : 'hide',
			users: results.users,
			show_anon: 'hide'
		};

		res.render('users', userData);
	});
}

usersController.getUsersForSearch = function(req, res, next) {
	var data = {
		search_display: 'block',
		loadmore_display: 'hidden',
		users: [],
		show_anon: 'hide'
	};

	res.render('users', data);
};



module.exports = usersController;
