"use strict";

var async = require('async');

var user = require('../user');
var adminFlagsController = require('./admin/flags');

var modsController = {};

modsController.flagged = function (req, res, next) {
	async.parallel([
		async.apply(user.isAdminOrGlobalMod, req.uid),
		async.apply(user.isModeratorOfAnyCategory, req.uid)
	], function (err, results) {
		if (err || !(results[0] || results[1])) {
			return next(err);
		}

		if (!results[0] && results[1]) {
			res.locals.cids = results[1];
		} 

		adminFlagsController.get(req, res, next);
	});
};

module.exports = modsController;
