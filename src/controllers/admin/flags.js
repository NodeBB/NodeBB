"use strict";

var async = require('async');
var posts = require('../../posts');
var analytics = require('../../analytics');

var flagsController = {};

flagsController.get = function(req, res, next) {
	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';
	var start = 0;
	var stop = 19;

	async.waterfall([
		function (next) {
			async.parallel({
				posts: function(next) {
					if (byUsername) {
						posts.getUserFlags(byUsername, sortBy, req.uid, start, stop, next);
					} else {
						var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
						posts.getFlags(set, req.uid, start, stop, next);
					}
				},
				analytics: function(next) {
					analytics.getDailyStatsForSet('analytics:flags', Date.now(), 30, next);
				}
			}, next);
		}
	], function (err, results) {
		if (err) {
			return next(err);
		}
		var data = {
			posts: results.posts,
			analytics: results.analytics,
			next: stop + 1,
			byUsername: byUsername,
			title: '[[pages:flagged-posts]]'
		};
		res.render('admin/manage/flags', data);
	});
};


module.exports = flagsController;
