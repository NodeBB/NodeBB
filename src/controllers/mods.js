"use strict";

var async = require('async');

var user = require('../user');
var flags = require('../flags');
// var adminFlagsController = require('./admin/flags');

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
		var valid = ['assignee', 'state', 'reporterId', 'type', 'targetUid', 'quick'];
		var filters = valid.reduce(function (memo, cur) {
			if (req.query.hasOwnProperty(cur)) {
				memo[cur] = req.query[cur];
			}

			return memo;
		}, {});

		flags.list(filters, req.uid, function (err, flags) {
			if (err) {
				return next(err);
			}

			res.render('flags/list', {
				flags: flags,
				hasFilter: !!Object.keys(filters).length,
				filters: filters
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
			assignees: results.assignees
		}));
	});
};

module.exports = modsController;
