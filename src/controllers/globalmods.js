'use strict';

var async = require('async');

var user = require('../user');
var adminBlacklistController = require('./admin/blacklist');

var globalModsController = module.exports;

globalModsController.ipBlacklist = function (req, res, next) {
	async.waterfall([
		function (next) {
			user.isAdminOrGlobalMod(req.uid, next);
		},
		function (isAdminOrGlobalMod, next) {
			if (!isAdminOrGlobalMod) {
				return next();
			}
			adminBlacklistController.get(req, res, next);
		},
	], next);
};
