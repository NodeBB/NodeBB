'use strict';

var async = require('async');

var accountHelpers = require('./helpers');

var blocksController = {};

blocksController.getBlocks = function (req, res, callback) {
	var userData;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			next();
		},
	], function (err) {
		if (err) {
			return callback(err);
		}

		res.render('account/blocks', userData);
	});
};

module.exports = blocksController;
