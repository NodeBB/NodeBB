'use strict';

var async = require('async');

var user = require('../user');
var adminFlagsController = require('./admin/flags');

var modsController = {};

modsController.flagged = function (req, res, next) {
	async.parallel({
		isAdminOrGlobalMod: async.apply(user.isAdminOrGlobalMod, req.uid),
		moderatedCids: async.apply(user.getModeratedCids, req.uid),
	}, function (err, results) {
		if (err || !(results.isAdminOrGlobalMod || !!results.moderatedCids.length)) {
			return next(err);
		}

		if (!results.isAdminOrGlobalMod && results.moderatedCids.length) {
			res.locals.cids = results.moderatedCids;
		}

		adminFlagsController.get(req, res, next);
	});
};

module.exports = modsController;
