'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');
var pagination = require('../../pagination');

var infoController = module.exports;

infoController.get = function (req, res, callback) {
	var userData;
	var page = Math.max(1, req.query.page || 1);
	var itemsPerPage = 10;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			var start = (page - 1) * itemsPerPage;
			var stop = start + itemsPerPage - 1;
			async.parallel({
				history: async.apply(user.getModerationHistory, userData.uid),
				sessions: async.apply(user.auth.getSessions, userData.uid, req.sessionID),
				usernames: async.apply(user.getHistory, 'user:' + userData.uid + ':usernames'),
				emails: async.apply(user.getHistory, 'user:' + userData.uid + ':emails'),
				notes: function (next) {
					if (!userData.isAdminOrGlobalModeratorOrModerator) {
						return setImmediate(next);
					}
					async.parallel({
						notes: function (next) {
							user.getModerationNotes(userData.uid, start, stop, next);
						},
						count: function (next) {
							db.sortedSetCard('uid:' + userData.uid + ':moderation:notes', next);
						},
					}, next);
				},
			}, next);
		},
		function (data) {
			userData.history = data.history;
			userData.sessions = data.sessions;
			userData.usernames = data.usernames;
			userData.emails = data.emails;

			if (userData.isAdminOrGlobalModeratorOrModerator) {
				userData.moderationNotes = data.notes.notes;
				var pageCount = Math.ceil(data.notes.count / itemsPerPage);
				userData.pagination = pagination.create(page, pageCount, req.query);
			}
			userData.title = '[[pages:account/info]]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:account_info]]' }]);

			res.render('account/info', userData);
		},
	], callback);
};
