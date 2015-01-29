"use strict";

var async = require('async'),
	nconf = require('nconf'),
	groups = require('../groups'),
	user = require('../user'),
	helpers = require('./helpers'),
	groupsController = {};

groupsController.list = function(req, res, next) {
	groups.list({
		truncateUserList: true,
		expand: true,
		uid: req.user ? req.user.uid : 0
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
			groups.getByGroupslug(req.params.slug, {
				expand: true,
				uid: uid
			}, next);
		},
		posts: function(next) {
			groups.getLatestMemberPosts(req.params.slug, 10, uid, next);
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

groupsController.members = function(req, res, next) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;
	async.waterfall([
		function(next) {
			groups.getGroupNameByGroupSlug(req.params.slug, next);
		},
		function(groupName, next) {
			user.getUsersFromSet('group:' + groupName + ':members', uid, 0, 49, next);
		},
	], function(err, users) {
		if (err) {
			return next(err);
		}

		res.render('groups/members', {
			users: users,
			nextStart: 50,
			loadmore_display: users.length > 50 ? 'block' : 'hide',
		});
	});
};

module.exports = groupsController;
