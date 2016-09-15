"use strict";

var async = require('async');
var posts = require('../../posts');
var user = require('../../user');
var analytics = require('../../analytics');
var pagination = require('../../pagination');

var flagsController = {};

flagsController.get = function(req, res, next) {
	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';

	var page = parseInt(req.query.page, 10) || 1;
	var itemsPerPage = 20;
	var start = (page - 1) * itemsPerPage;
	var stop = start + itemsPerPage - 1;

	async.parallel({
		flagData: function(next) {
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
		assignees: function(next) {
			user.getAdminsandGlobalMods(next);
		}
	}, function (err, results) {
		if (err) {
			return next(err);
		}

		// Minimise data set for assignees so tjs does less work
		results.assignees = results.assignees.map(function(userObj) {
			return {
				uid: userObj.uid,
				username: userObj.username
			};
		});

		var pageCount = Math.max(1, Math.ceil(results.flagData.count / itemsPerPage));

		var data = {
			posts: results.flagData.posts,
			assignees: results.assignees,
			analytics: results.analytics,
			next: stop + 1,
			byUsername: byUsername,
			pagination: pagination.create(page, pageCount, req.query),
			title: '[[pages:flagged-posts]]'
		};
		res.render('admin/manage/flags', data);
	});
};


module.exports = flagsController;
