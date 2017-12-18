'use strict';

var async = require('async');

var categories = require('../../categories');
var privileges = require('../../privileges');

var privilegesController = module.exports;

privilegesController.get = function (req, res, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				privileges: async.apply(privileges.global.list),
				allCategories: async.apply(categories.buildForSelect, req.uid, 'read'),
			}, next);
		},
		function (data) {
			res.render('admin/manage/privileges', {
				privileges: data.privileges,
				allCategories: data.allCategories,
			});
		},
	], callback);
};
