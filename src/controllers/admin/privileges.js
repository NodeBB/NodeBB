'use strict';

var async = require('async');

var categories = require('../../categories');
var privileges = require('../../privileges');

var privilegesController = module.exports;

privilegesController.get = function (req, res, callback) {
	var cid = req.params.cid ? req.params.cid : 0;
	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function (next) {
					if (!cid) {
						privileges.global.list(next);
					} else {
						privileges.categories.list(cid, next);
					}
				},
				allCategories: async.apply(categories.buildForSelect, req.uid, 'read'),
			}, next);
		},
		function (data) {
			data.allCategories.forEach(function (category) {
				if (category) {
					category.selected = parseInt(category.cid, 10) === parseInt(cid, 10);
				}
			});

			res.render('admin/manage/privileges', {
				privileges: data.privileges,
				allCategories: data.allCategories,
				cid: cid,
			});
		},
	], callback);
};
