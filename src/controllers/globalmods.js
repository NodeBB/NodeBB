"use strict";

var user = require('../user');
var adminFlagsController = require('./admin/flags');
var adminBlacklistController = require('./admin/blacklist');

var globalModsController = {};

globalModsController.flagged = function(req, res, next) {
	user.isAdminOrGlobalMod(req.uid, function(err, isAdminOrGlobalMod) {
		if (err || !isAdminOrGlobalMod) {
			return next(err);
		}

		adminFlagsController.get(req, res, next);
	});
};

globalModsController.ipBlacklist = function(req, res, next) {
	user.isAdminOrGlobalMod(req.uid, function(err, isAdminOrGlobalMod) {
		if (err || !isAdminOrGlobalMod) {
			return next(err);
		}

		adminBlacklistController.get(req, res, next);
	});
};

module.exports = globalModsController;
