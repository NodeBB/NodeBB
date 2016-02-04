"use strict";

var async = require('async');
var posts = require('../../posts');

var flagsController = {};

flagsController.get = function(req, res, next) {
	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';
	var start = 0;
	var stop = 19;

	async.waterfall([
		function (next) {
			if (byUsername) {
				posts.getUserFlags(byUsername, sortBy, req.uid, start, stop, next);
			} else {
				var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
				posts.getFlags(set, req.uid, start, stop, next);
			}
		}
	], function (err, posts) {
		if (err) {
			return next(err);
		}
		var data = {
			posts: posts, 
			next: stop + 1, 
			byUsername: byUsername,
			title: '[[pages:flagged-posts]]'
		};
		res.render('admin/manage/flags', data);
	});
};


module.exports = flagsController;
