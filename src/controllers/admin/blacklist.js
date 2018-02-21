'use strict';

var async = require('async');
var meta = require('../../meta');
var analytics = require('../../analytics');

var blacklistController = module.exports;

blacklistController.get = function (req, res, next) {
	async.parallel({
		rules: async.apply(meta.blacklist.get),
		analytics: async.apply(analytics.getBlacklistAnalytics),
	}, function (err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/manage/ip-blacklist', Object.assign(data, {
			title: '[[pages:ip-blacklist]]',
		}));
	});
};
