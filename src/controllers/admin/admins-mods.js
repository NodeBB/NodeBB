'use strict';

var async = require('async');

var groups = require('../../groups');
var categories = require('../../categories');

var AdminsMods = module.exports;

AdminsMods.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				admins: function (next) {
					groups.get('administrators', { uid: req.uid }, next);
				},
				globalMods: function (next) {
					groups.get('Global Moderators', { uid: req.uid }, next);
				},
				categories: function (next) {
					getModeratorsOfCategories(req.uid, next);
				},
			}, next);
		},
		function (results) {
			res.render('admin/manage/admins-mods', results);
		},
	], next);
};

function getModeratorsOfCategories(uid, callback) {
	async.waterfall([
		function (next) {
			categories.buildForSelect(uid, 'find', next);
		},
		function (categoryData, next) {
			async.map(categoryData, function (category, next) {
				async.waterfall([
					function (next) {
						categories.getModerators(category.cid, next);
					},
					function (moderators, next) {
						category.moderators = moderators;
						next(null, category);
					},
				], next);
			}, next);
		},
	], callback);
}
