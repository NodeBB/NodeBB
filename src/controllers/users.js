"use strict";

var async = require('async');
var user = require('../user');
var meta = require('../meta');

var pagination = require('../pagination');
var db = require('../database');
var helpers = require('./helpers');


var usersController = {};

usersController.getOnlineUsers = function(req, res, next) {
	async.parallel({
		users: function(next) {
			usersController.getUsers('users:online', req.uid, req.query.page, next);
		},
		guests: function(next) {
			require('../socket.io/admin/rooms').getTotalGuestCount(next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		var userData = results.users;
		var hiddenCount = 0;
		if (!userData.isAdminOrGlobalMod) {
			userData.users = userData.users.filter(function(user) {
				if (user && user.status === 'offline') {
					hiddenCount ++;
				}
				return user && user.status !== 'offline';
			});
		}

		userData.anonymousUserCount = results.guests + hiddenCount;

		render(req, res, userData, next);
	});
};

usersController.getUsersSortedByPosts = function(req, res, next) {
	usersController.renderUsersPage('users:postcount', req, res, next);
};

usersController.getUsersSortedByReputation = function(req, res, next) {
	if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
		return next();
	}
	usersController.renderUsersPage('users:reputation', req, res, next);
};

usersController.getUsersSortedByJoinDate = function(req, res, next) {
	usersController.renderUsersPage('users:joindate', req, res, next);
};

usersController.getBannedUsers = function(req, res, next) {
	usersController.getUsers('users:banned', req.uid, req.query.page, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData.isAdminOrGlobalMod) {
			return next();
		}

		render(req, res, userData, next);
	});
};

usersController.getFlaggedUsers = function(req, res, next) {
	usersController.getUsers('users:flags', req.uid, req.query.page, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData.isAdminOrGlobalMod) {
			return next();
		}

		render(req, res, userData, next);
	});
};

usersController.renderUsersPage = function(set, req, res, next) {
	usersController.getUsers(set, req.uid, req.query.page, function(err, userData) {
		if (err) {
			return next(err);
		}
		render(req, res, userData, next);
	});
};

usersController.getUsers = function(set, uid, page, callback) {
	var setToData = {
		'users:postcount': {title: '[[pages:users/sort-posts]]', crumb: '[[users:top_posters]]'},
		'users:reputation': {title: '[[pages:users/sort-reputation]]', crumb: '[[users:most_reputation]]'},
		'users:joindate': {title: '[[pages:users/latest]]', crumb: '[[global:users]]'},
		'users:online': {title: '[[pages:users/online]]', crumb: '[[global:online]]'},
		'users:banned': {title: '[[pages:users/banned]]', crumb: '[[user:banned]]'},
		'users:flags': {title: '[[pages:users/most-flags]]', crumb: '[[users:most_flags]]'},
	};

	if (!setToData[set]) {
		setToData[set] = {title: '', crumb: ''};
	}

	var breadcrumbs = [{text: setToData[set].crumb}];

	if (set !== 'users:joindate') {
		breadcrumbs.unshift({text: '[[global:users]]', url: '/users'});
	}

	page = parseInt(page, 10) || 1;
	var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 50;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;

	async.parallel({
		isAdministrator: function(next) {
			user.isAdministrator(uid, next);
		},
		isGlobalMod: function(next) {
			user.isGlobalModerator(uid, next);
		},
		usersData: function(next) {
			usersController.getUsersAndCount(set, uid, start, stop, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var pageCount = Math.ceil(results.usersData.count / resultsPerPage);
		var userData = {
			loadmore_display: results.usersData.count > (stop - start + 1) ? 'block' : 'hide',
			users: results.usersData.users,
			pagination: pagination.create(page, pageCount),
			userCount: results.usersData.count,
			title: setToData[set].title || '[[pages:users/latest]]',
			breadcrumbs: helpers.buildBreadcrumbs(breadcrumbs),
			setName: set,
			isAdminOrGlobalMod: results.isAdministrator || results.isGlobalMod
		};
		userData['route_' + set] = true;
		callback(null, userData);
	});
};

usersController.getUsersAndCount = function(set, uid, start, stop, callback) {
	async.parallel({
		users: function(next) {
			user.getUsersFromSet(set, uid, start, stop, next);
		},
		count: function(next) {
			if (set === 'users:online') {
				var now = Date.now();
				db.sortedSetCount('users:online', now - 300000, '+inf', next);
			} else if (set === 'users:banned') {
				db.sortedSetCard('users:banned', next);
			} else if (set === 'users:flags') {
				db.sortedSetCard('users:flags', next);
			} else {
				db.getObjectField('global', 'userCount', next);
			}
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

function render(req, res, data, next) {
	var registrationType = meta.config.registrationType;

	data.maximumInvites = meta.config.maximumInvites;
	data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
	data.adminInviteOnly = registrationType === 'admin-invite-only';
	data['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;

	user.getInvitesNumber(req.uid, function(err, numInvites) {
		if (err) {
			return next(err);
		}

		res.append('X-Total-Count', data.userCount);
		data.invites = numInvites;

		res.render('users', data);
	});
}

module.exports = usersController;
