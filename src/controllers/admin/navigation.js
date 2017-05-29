'use strict';

var async = require('async');

var navigationAdmin = require('../../navigation/admin');
var navigationController = module.exports;

navigationController.get = function (req, res, next) {
	async.waterfall([
		navigationAdmin.getAdmin,
		function (data) {
			data.enabled.forEach(function (enabled, index) {
				enabled.index = index;
				enabled.selected = index === 0;
			});

			data.navigation = data.enabled.slice();

			res.render('admin/general/navigation', data);
		},
	], next);
};
