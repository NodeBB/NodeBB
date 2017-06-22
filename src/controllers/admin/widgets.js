'use strict';

var async = require('async');

var widgetsController = module.exports;

widgetsController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			require('../../widgets/admin').get(next);
		},
		function (data) {
			res.render('admin/extend/widgets', data);
		},
	], next);
};
