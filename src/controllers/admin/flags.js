"use strict";

var async = require('async');
var validator = require('validator');

var posts = require('../../posts');
var user = require('../../user');
var categories = require('../../categories');
var analytics = require('../../analytics');
var pagination = require('../../pagination');

var flagsController = {};

var itemsPerPage = 20;

flagsController.get = function(req, res, next) {
	var byUsername = req.query.byUsername || '';
	var cid = req.query.cid || 0;
	var sortBy = req.query.sortBy || 'count';
	var page = parseInt(req.query.page, 10) || 1;

	async.parallel({
		categories: function(next) {
			categories.buildForSelect(req.uid, next);
		},
		flagData: function(next) {
			getFlagData(req, next);
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

		results.categories.forEach(function(category) {
			category.selected = parseInt(category.cid, 10) === parseInt(cid, 10);
		});

		var data = {
			posts: results.flagData.posts,
			assignees: results.assignees,
			analytics: results.analytics,
			categories: results.categories,
			byUsername: validator(String(byUsername)),
			sortByCount: sortBy === 'count',
			sortByTime: sortBy === 'time',
			pagination: pagination.create(page, pageCount, req.query),
			title: '[[pages:flagged-posts]]'
		};
		res.render('admin/manage/flags', data);
	});
};

function getFlagData(req, callback) {
	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';
	var cid = req.query.cid || 0;
	var page = parseInt(req.query.page, 10) || 1;
	var start = (page - 1) * itemsPerPage;
	var stop = start + itemsPerPage - 1;

	var sets = [sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged'];

	async.waterfall([
		function(next) {
			if (byUsername) {
				user.getUidByUsername(byUsername, next);
			} else {
				process.nextTick(next, null, 0);
			}
		},
		function(uid, next) {
			if (uid) {
				sets.push('uid:' + uid + ':flag:pids');
			}

			posts.getFlags(sets, cid, req.uid, start, stop, next);
		}
	], callback);
}


module.exports = flagsController;
