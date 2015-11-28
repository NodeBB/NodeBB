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

function render(req, res, data, next) {
	plugins.fireHook('filter:users.build', { req: req, res: res, templateData: data }, function(err, data) {
		if (err) {
			return next(err);
		}

		var registrationType = meta.config.registrationType;

		data.templateData.maximumInvites = meta.config.maximumInvites;
		data.templateData.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
		data.templateData['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;

		user.getInvitesNumber(req.uid, function(err, num) {
			if (err) {
				return next(err);
			}

			data.templateData.invites = num;
			res.render('users', data.templateData);
		});

	});
}



module.exports = usersController;
