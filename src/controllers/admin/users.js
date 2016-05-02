"use strict";

var async = require('async');
var user = require('../../user');
var meta = require('../../meta');
var db = require('../../database');
var pagination = require('../../pagination');


var usersController = {};

usersController.search = function(req, res, next) {
	res.render('admin/manage/users', {
		search_display: '',
		users: []
	});
};

usersController.sortByJoinDate = function(req, res, next) {
	getUsers('users:joindate', 'latest', req, res, next);
};

usersController.notValidated = function(req, res, next) {
	getUsers('users:notvalidated', 'notvalidated', req, res, next);
};

usersController.noPosts = function(req, res, next) {
	getUsersByScore('users:postcount', 'noposts', 0, 0, req, res, next);
};

usersController.inactive = function(req, res, next) {
	var timeRange = 1000 * 60 * 60 * 24 * 30 * (parseInt(req.query.months, 10) || 3);
	var cutoff = Date.now() - timeRange;
	getUsersByScore('users:online', 'inactive', '-inf', cutoff, req, res, next);
};

function getUsersByScore(set, section, min, max, req, res, callback) {
	var page = parseInt(req.query.page, 10) || 1;
	var resultsPerPage = 25;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var count = 0;

	async.waterfall([
		function (next) {
			async.parallel({
				count: function (next) {
					db.sortedSetCount(set, min, max, next);
				},
				uids: function (next) {
					db.getSortedSetRevRangeByScore(set, start, resultsPerPage, max, min, next);
				}
			}, next);
		},
		function (results, next) {
			count = results.count;
			user.getUsers(results.uids, req.uid, next);
		}
	], function(err, users) {
		if (err) {
			return callback(err);
		}
		users = users.filter(function(user) {
			return user && parseInt(user.uid, 10);
		});
		var data = {
			users: users,
			page: page,
			pageCount: Math.ceil(count / resultsPerPage)
		};
		data[section] = true;
		render(req, res, data);
	});
}

usersController.banned = function(req, res, next) {
	getUsers('users:banned', 'banned', req, res, next);
};

usersController.registrationQueue = function(req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var itemsPerPage = 20;
	var start = (page - 1) * 20;
	var stop = start + itemsPerPage - 1;
	var invitations;
	async.parallel({
		registrationQueueCount: function(next) {
			db.sortedSetCard('registration:queue', next);
		},
		users: function(next) {
			user.getRegistrationQueue(start, stop, next);
		},
		invites: function(next) {
			async.waterfall([
				function(next) {
					user.getAllInvites(next);
				},
				function(_invitations, next) {
					invitations = _invitations;
					async.map(invitations, function(invites, next) {
						user.getUserField(invites.uid, 'username', next);
					}, next);
				},
				function(usernames, next) {
					invitations.forEach(function(invites, index) {
						invites.username = usernames[index];
					});
					async.map(invitations, function(invites, next) {
						async.map(invites.invitations, user.getUsernameByEmail, next);
					}, next);
				},
				function(usernames, next) {
					invitations.forEach(function(invites, index) {
						invites.invitations = invites.invitations.map(function(email, i) {
							return {
								email: email,
								username: usernames[index][i] === '[[global:guest]]' ? '' : usernames[index][i]
							};
						});
					});
					next(null, invitations);
				}
			], next);
		}
	}, function(err, data) {
		if (err) {
			return next(err);
		}
		var pageCount = Math.max(1, Math.ceil(data.registrationQueueCount / itemsPerPage));
		data.pagination = pagination.create(page, pageCount);
		res.render('admin/manage/registration', data);
	});
};

function getUsers(set, section, req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var resultsPerPage = 25;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;

	async.parallel({
		count: function(next) {
			db.sortedSetCard(set, next);
		},
		users: function(next) {
			user.getUsersFromSet(set, req.uid, start, stop, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		results.users = results.users.filter(function(user) {
			return user && parseInt(user.uid, 10);
		});
		var data = {
			users: results.users,
			page: page,
			pageCount: Math.max(1, Math.ceil(results.count / resultsPerPage))
		};
		data[section] = true;
		render(req, res, data);
	});
}

function render(req, res, data) {
	data.search_display = 'hidden';
	data.pagination = pagination.create(data.page, data.pageCount, req.query);
	data.requireEmailConfirmation = parseInt(meta.config.requireEmailConfirmation, 10) === 1;

	var registrationType = meta.config.registrationType;

	data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
	data.adminInviteOnly = registrationType === 'admin-invite-only';

	res.render('admin/manage/users', data);
}

usersController.getCSV = function(req, res, next) {
	user.getUsersCSV(function(err, data) {
		if (err) {
			return next(err);
		}
		res.attachment('users.csv');
		res.setHeader('Content-Type', 'text/csv');
		res.end(data);
	});
};

module.exports = usersController;
