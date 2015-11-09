"use strict";

var posts = require('../../posts');

var flagsController = {};

flagsController.get = function(req, res, next) {
	function done(err, posts) {
		if (err) {
			return next(err);
		}
		res.render('admin/manage/flags', {posts: posts, next: stop + 1, byUsername: byUsername});
	}

	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';
	var start = 0;
	var stop = 19;

	if (byUsername) {
		posts.getUserFlags(byUsername, sortBy, req.uid, start, stop, done);
	} else {
		var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
		posts.getFlags(set, req.uid, start, stop, done);
	}
};


module.exports = flagsController;
