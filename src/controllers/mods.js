"use strict";

var async = require('async');

var user = require('../user');
var categories = require('../categories');
var flags = require('../flags');
var analytics = require('../analytics');

var modsController = {
	flags: {}
};

modsController.flags.list = function (req, res, next) {
	async.parallel({
		isAdminOrGlobalMod: async.apply(user.isAdminOrGlobalMod, req.uid),
		moderatedCids: async.apply(user.getModeratedCids, req.uid)
	}, function (err, results) {
		if (err) {
			return next(err);
		} else if (!(results.isAdminOrGlobalMod || !!results.moderatedCids.length)) {
			return next(new Error('[[error:no-privileges]]'));
		}

		if (!results.isAdminOrGlobalMod && results.moderatedCids.length) {
			res.locals.cids = results.moderatedCids;
		}

		// Parse query string params for filters
		var valid = ['assignee', 'state', 'reporterId', 'type', 'targetUid', 'cid', 'quick'];
		var filters = valid.reduce(function (memo, cur) {
			if (req.query.hasOwnProperty(cur)) {
				memo[cur] = req.query[cur];
			}

			return memo;
		}, {});

		async.parallel({
			flags: async.apply(flags.list, filters, req.uid),
			analytics: async.apply(analytics.getDailyStatsForSet, 'analytics:flags', Date.now(), 30),
			categories: async.apply(categories.buildForSelect, req.uid)
		}, function (err, data) {
			if (err) {
				return next(err);
			}

			// Minimal returned set for templates.js
			data.categories = data.categories.reduce(function (memo, cur) {
				memo[cur.cid] = cur.name;
				return memo;
			}, {});

			res.render('flags/list', {
				flags: data.flags,
				analytics: data.analytics,
				categories: data.categories,
				hasFilter: !!Object.keys(filters).length,
				filters: filters,
				title: '[[pages:flags]]'
			});
		});
	});
};

modsController.flags.detail = function (req, res, next) {
	async.parallel({
		isAdminOrGlobalMod: async.apply(user.isAdminOrGlobalMod, req.uid),
		moderatedCids: async.apply(user.getModeratedCids, req.uid),
		flagData: async.apply(flags.get, req.params.flagId),
		assignees: async.apply(user.getAdminsandGlobalModsandModerators)
	}, function (err, results) {
		if (err || !results.flagData) {
			return next(err || new Error('[[error:invalid-data]]'));
		} else if (!(results.isAdminOrGlobalMod || !!results.moderatedCids.length)) {
			return next(new Error('[[error:no-privileges]]'));
		}

		res.render('flags/detail', Object.assign(results.flagData, {
			assignees: results.assignees,
			type_bool: ['post', 'user'].reduce(function (memo, cur) {
				memo[cur] = results.flagData.type === cur;
				return memo;
			}, {}),
			title: '[[pages:flag-details, ' + req.params.flagId + ']]'
		}));
	});
};

module.exports = modsController;
