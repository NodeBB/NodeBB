"use strict";

var user = require('../user');
var adminFlagsController = require('./admin/flags');

var postsController = {};

postsController.flagged = function(req, res, next) {
	user.isAdminOrGlobalMod(req.uid, function(err, isAdminOrGlobalMod) {
		if (err || !isAdminOrGlobalMod) {
			return next(err);
		}

		adminFlagsController.get(req, res, next);
	});
};


module.exports = postsController;
