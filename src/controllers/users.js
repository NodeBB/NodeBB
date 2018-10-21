'use strict';

var async = require('async');
var user = require('../user');
var meta = require('../meta');

var db = require('../database');
var pagination = require('../pagination');
var privileges = require('../privileges');
var helpers = require('./helpers');

var usersController = module.exports;

usersController.index = function (req, res, next) {
	var section = req.query.section || 'joindate';
	var sectionToController = {
		joindate: usersController.getUsersSortedByJoinDate,
		online: usersController.getOnlineUsers,
		'sort-posts': usersController.getUsersSortedByPosts,
		'sort-reputation': usersController.getUsersSortedByReputation,
		banned: usersController.getBannedUsers,
		flagged: usersController.getFlaggedUsers,
	};

	if (req.query.term) {
		usersController.search(req, res, next);
	} else if (sectionToController[section]) {
		sectionToController[section](req, res, next);
	} else {
		usersController.getUsersSortedByJoinDate(req, res, next);
	}
};

usersController.search = function (req, res, next) {
	async.waterfall([
		function (next) {
			privileges.global.can('search:users', req.uid, next);
		},
		function (allowed, next) {
			if (!allowed) {
				return next(new Error('[[error:no-privileges]]'));
			}
			async.parallel({
				search: function (next) {
					user.search({
						query: req.query.term,
						searchBy: req.query.searchBy || 'username',
						page: req.query.page || 1,
						sortBy: req.query.sortBy || 'joindate',
						onlineOnly: req.query.onlineOnly === 'true',
						bannedOnly: req.query.bannedOnly === 'true',
						flaggedOnly: req.query.flaggedOnly === 'true',
					}, next);
				},
				isAdminOrGlobalMod: function (next) {
					user.isAdminOrGlobalMod(req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			var section = req.query.section || 'joindate';

			results.search.isAdminOrGlobalMod = results.isAdminOrGlobalMod;
			results.search.pagination = pagination.create(req.query.page, results.search.pageCount, req.query);
			results.search['section_' + section] = true;
			results.displayUserSearch = true;
			render(req, res, results.search, next);
		},
	], next);
};

usersController.getOnlineUsers = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				users: function (next) {
					usersController.getUsers('users:online', req.uid, req.query, next);
				},
				guests: function (next) {
					require('../socket.io/admin/rooms').getTotalGuestCount(next);
				},
			}, next);
		},
		function (results, next) {
			var userData = results.users;
			var hiddenCount = 0;
			if (!userData.isAdminOrGlobalMod) {
				userData.users = userData.users.filter(function (user) {
					if (user && user.status === 'offline') {
						hiddenCount += 1;
					}
					return user && user.status !== 'offline';
				});
			}

			userData.anonymousUserCount = results.guests + hiddenCount;

			render(req, res, userData, next);
		},
	], next);
};

usersController.getUsersSortedByPosts = function (req, res, next) {
	usersController.renderUsersPage('users:postcount', req, res, next);
};

usersController.getUsersSortedByReputation = function (req, res, next) {
	if (meta.config['reputation:disabled']) {
		return next();
	}
	usersController.renderUsersPage('users:reputation', req, res, next);
};

usersController.getUsersSortedByJoinDate = function (req, res, next) {
	usersController.renderUsersPage('users:joindate', req, res, next);
};

usersController.getBannedUsers = function (req, res, next) {
	renderIfAdminOrGlobalMod('users:banned', req, res, next);
};

usersController.getFlaggedUsers = function (req, res, next) {
	renderIfAdminOrGlobalMod('users:flags', req, res, next);
};

function renderIfAdminOrGlobalMod(set, req, res, next) {
	async.waterfall([
		function (next) {
			user.isAdminOrGlobalMod(req.uid, next);
		},
		function (isAdminOrGlobalMod, next) {
			if (!isAdminOrGlobalMod) {
				return helpers.notAllowed(req, res);
			}
			usersController.renderUsersPage(set, req, res, next);
		},
	], next);
}

usersController.renderUsersPage = function (set, req, res, next) {
	async.waterfall([
		function (next) {
			usersController.getUsers(set, req.uid, req.query, next);
		},
		function (userData, next) {
			render(req, res, userData, next);
		},
	], next);
};

usersController.getUsers = function (set, uid, query, callback) {
	var setToData = {
		'users:postcount': { title: '[[pages:users/sort-posts]]', crumb: '[[users:top_posters]]' },
		'users:reputation': { title: '[[pages:users/sort-reputation]]', crumb: '[[users:most_reputation]]' },
		'users:joindate': { title: '[[pages:users/latest]]', crumb: '[[global:users]]' },
		'users:online': { title: '[[pages:users/online]]', crumb: '[[global:online]]' },
		'users:banned': { title: '[[pages:users/banned]]', crumb: '[[user:banned]]' },
		'users:flags': { title: '[[pages:users/most-flags]]', crumb: '[[users:most_flags]]' },
	};

	if (!setToData[set]) {
		setToData[set] = { title: '', crumb: '' };
	}

	var breadcrumbs = [{ text: setToData[set].crumb }];

	if (set !== 'users:joindate') {
		breadcrumbs.unshift({ text: '[[global:users]]', url: '/users' });
	}

	var page = parseInt(query.page, 10) || 1;
	var resultsPerPage = meta.config.userSearchResultsPerPage;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;

	async.waterfall([
		function (next) {
			async.parallel({
				isAdminOrGlobalMod: function (next) {
					user.isAdminOrGlobalMod(uid, next);
				},
				canSearch: function (next) {
					privileges.global.can('search:users', uid, next);
				},
				usersData: function (next) {
					usersController.getUsersAndCount(set, uid, start, stop, next);
				},
			}, next);
		},
		function (results, next) {
			var pageCount = Math.ceil(results.usersData.count / resultsPerPage);
			var userData = {
				users: results.usersData.users,
				pagination: pagination.create(page, pageCount, query),
				userCount: results.usersData.count,
				title: setToData[set].title || '[[pages:users/latest]]',
				breadcrumbs: helpers.buildBreadcrumbs(breadcrumbs),
				isAdminOrGlobalMod: results.isAdminOrGlobalMod,
				displayUserSearch: results.canSearch,
			};
			userData['section_' + (query.section || 'joindate')] = true;
			next(null, userData);
		},
	], callback);
};

usersController.getUsersAndCount = function (set, uid, start, stop, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				users: function (next) {
					user.getUsersFromSet(set, uid, start, stop, next);
				},
				count: function (next) {
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
				},
			}, next);
		},
		function (results, next) {
			results.users = results.users.filter(function (user) {
				return user && parseInt(user.uid, 10);
			});

			next(null, results);
		},
	], callback);
};

function render(req, res, data, next) {
	var registrationType = meta.config.registrationType;

	data.maximumInvites = meta.config.maximumInvites;
	data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
	data.adminInviteOnly = registrationType === 'admin-invite-only';
	data['reputation:disabled'] = meta.config['reputation:disabled'];

	async.waterfall([
		function (next) {
			user.getInvitesNumber(req.uid, next);
		},
		function (numInvites) {
			res.append('X-Total-Count', data.userCount);
			data.invites = numInvites;

			res.render('users', data);
		},
	], next);
}
