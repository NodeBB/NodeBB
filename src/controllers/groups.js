"use strict";

var groups = require('../groups'),
	async = require('async'),
	nconf = require('nconf'),
	helpers = require('./helpers'),
	groupsController = {};

groupsController.list = function(req, res, next) {
	groups.list({
		truncateUserList: true,
		expand: true
	}, function(err, groups) {
		if (err) {
			return next(err);
		}
		res.render('groups/list', {
			groups: groups
		});
	});
};

groupsController.details = function(req, res, next) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;
	async.parallel({
		group: function(next) {
			groups.get(req.params.name, {
				expand: true
			}, next);
		},
		posts: function(next) {
			groups.getLatestMemberPosts(req.params.name, 10, uid, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		if (!results.group) {
			return helpers.notFound(req, res);
		}

		res.render('groups/details', results);
	});
};

module.exports = groupsController;
