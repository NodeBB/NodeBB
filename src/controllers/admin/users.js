'use strict';

var async = require('async');
var validator = require('validator');
var nconf = require('nconf');

var user = require('../../user');
var meta = require('../../meta');
var db = require('../../database');
var pagination = require('../../pagination');
var events = require('../../events');
var plugins = require('../../plugins');

var usersController = module.exports;

var userFields = ['uid', 'username', 'userslug', 'email', 'postcount', 'joindate', 'banned',
	'reputation', 'picture', 'flags', 'lastonline', 'email:confirmed'];

usersController.search = function (req, res) {
	res.render('admin/manage/users', {
		search_display: '',
		users: [],
	});
};

usersController.sortByJoinDate = function (req, res, next) {
	getUsers('users:joindate', 'latest', undefined, undefined, req, res, next);
};

usersController.notValidated = function (req, res, next) {
	getUsers('users:notvalidated', 'notvalidated', undefined, undefined, req, res, next);
};

usersController.noPosts = function (req, res, next) {
	getUsers('users:postcount', 'noposts', '-inf', 0, req, res, next);
};

usersController.topPosters = function (req, res, next) {
	getUsers('users:postcount', 'topposts', 0, '+inf', req, res, next);
};

usersController.mostReputaion = function (req, res, next) {
	getUsers('users:reputation', 'mostreputation', 0, '+inf', req, res, next);
};

usersController.flagged = function (req, res, next) {
	getUsers('users:flags', 'mostflags', 1, '+inf', req, res, next);
};

usersController.inactive = function (req, res, next) {
	var timeRange = 1000 * 60 * 60 * 24 * 30 * (parseInt(req.query.months, 10) || 3);
	var cutoff = Date.now() - timeRange;
	getUsers('users:online', 'inactive', '-inf', cutoff, req, res, next);
};

usersController.banned = function (req, res, next) {
	getUsers('users:banned', 'banned', undefined, undefined, req, res, next);
};

usersController.registrationQueue = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var itemsPerPage = 20;
	var start = (page - 1) * 20;
	var stop = start + itemsPerPage - 1;
	var invitations;

	async.waterfall([
		function (next) {
			async.parallel({
				registrationQueueCount: function (next) {
					db.sortedSetCard('registration:queue', next);
				},
				users: function (next) {
					user.getRegistrationQueue(start, stop, next);
				},
				customHeaders: function (next) {
					plugins.fireHook('filter:admin.registrationQueue.customHeaders', { headers: [] }, next);
				},
				invites: function (next) {
					async.waterfall([
						function (next) {
							user.getAllInvites(next);
						},
						function (_invitations, next) {
							invitations = _invitations;
							async.map(invitations, function (invites, next) {
								user.getUserField(invites.uid, 'username', next);
							}, next);
						},
						function (usernames, next) {
							invitations.forEach(function (invites, index) {
								invites.username = usernames[index];
							});
							async.map(invitations, function (invites, next) {
								async.map(invites.invitations, user.getUsernameByEmail, next);
							}, next);
						},
						function (usernames, next) {
							invitations.forEach(function (invites, index) {
								invites.invitations = invites.invitations.map(function (email, i) {
									return {
										email: email,
										username: usernames[index][i] === '[[global:guest]]' ? '' : usernames[index][i],
									};
								});
							});
							next(null, invitations);
						},
					], next);
				},
			}, next);
		},
		function (data) {
			var pageCount = Math.max(1, Math.ceil(data.registrationQueueCount / itemsPerPage));
			data.pagination = pagination.create(page, pageCount);
			data.customHeaders = data.customHeaders.headers;
			res.render('admin/manage/registration', data);
		},
	], next);
};

function getUsers(set, section, min, max, req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var resultsPerPage = 50;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;
	var byScore = min !== undefined && max !== undefined;

	async.waterfall([
		function (next) {
			async.parallel({
				count: function (next) {
					if (byScore) {
						db.sortedSetCount(set, min, max, next);
					} else if (set === 'users:banned' || set === 'users:notvalidated') {
						db.sortedSetCard(set, next);
					} else {
						db.getObjectField('global', 'userCount', next);
					}
				},
				users: function (next) {
					async.waterfall([
						function (next) {
							if (byScore) {
								db.getSortedSetRevRangeByScore(set, start, resultsPerPage, max, min, next);
							} else {
								user.getUidsFromSet(set, start, stop, next);
							}
						},
						function (uids, next) {
							user.getUsersWithFields(uids, userFields, req.uid, next);
						},
					], next);
				},
			}, next);
		},
		function (results) {
			results.users = results.users.filter(function (user) {
				user.email = validator.escape(String(user.email || ''));
				return user && parseInt(user.uid, 10);
			});
			var data = {
				users: results.users,
				page: page,
				pageCount: Math.max(1, Math.ceil(results.count / resultsPerPage)),
			};
			data[section] = true;
			render(req, res, data);
		},
	], next);
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

usersController.getCSV = function (req, res, next) {
	var referer = req.headers.referer;

	if (!referer || !referer.replace(nconf.get('url'), '').startsWith('/admin/manage/users')) {
		return res.status(403).send('[[error:invalid-origin]]');
	}
	events.log({
		type: 'getUsersCSV',
		uid: req.uid,
		ip: req.ip,
	});
	async.waterfall([
		function (next) {
			user.getUsersCSV(next);
		},
		function (data) {
			res.attachment('users.csv');
			res.setHeader('Content-Type', 'text/csv');
			res.end(data);
		},
	], next);
};
