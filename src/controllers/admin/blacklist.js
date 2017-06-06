'use strict';

var async = require('async');
var meta = require('../../meta');

var blacklistController = module.exports;

blacklistController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			meta.blacklist.get(next);
		},
		function (rules) {
			res.render('admin/manage/ip-blacklist', {
				rules: rules,
				title: '[[pages:ip-blacklist]]',
			});
		},
	], next);
};
