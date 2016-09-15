"use strict";

var async = require('async');
var posts = require('../../posts');
var user = require('../../user');
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
				},
				assignees: async.apply(user.getAdminsandGlobalMods)
			}, next);
		}
	], function (err, results) {
		if (err) {
			return next(err);
		}

		// Minimise data set for assignees so tjs does less work
		results.assignees = results.assignees.map(function(userObj) {
			var keep = ['uid', 'username'];
			for(var prop in userObj) {
				if (userObj.hasOwnProperty(prop)) {
					if (keep.indexOf(prop) === -1) {
						delete userObj[prop];
					}
				}
			}

			return userObj;
		});

		var data = {
			posts: results.posts,
			assignees: results.assignees,
			analytics: results.analytics,
			next: stop + 1,
			byUsername: byUsername,
			title: '[[pages:flagged-posts]]'
		};
		res.render('admin/manage/flags', data);
	});
};


module.exports = flagsController;
