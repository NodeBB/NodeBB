'use strict';

var async = require('async');

var rewardsController = module.exports;

rewardsController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			require('../../rewards/admin').get(next);
		},
		function (data) {
			res.render('admin/extend/rewards', data);
		},
	], next);
};


module.exports = rewardsController;
