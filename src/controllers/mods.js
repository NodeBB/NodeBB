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

		flags.list({}, function(err, flags) {
			res.render('flags/list', {
				flags: flags
			});
		});
	});
};

modsController.flags.detail = function (req, res, next) {
	async.parallel({
		isAdminOrGlobalMod: async.apply(user.isAdminOrGlobalMod, req.uid),
		moderatedCids: async.apply(user.getModeratedCids, req.uid),
		flagData: async.apply(flags.get, req.params.flagId)
	}, function (err, results) {
		if (err || !results.flagData) {
			return next(err || new Error('[[error:invalid-data]]'));
		} else if (!(results.isAdminOrGlobalMod || !!results.moderatedCids.length)) {
			return next(new Error('[[error:no-privileges]]'));
		}

		res.render('flags/detail', results.flagData);
	});
};

module.exports = modsController;
