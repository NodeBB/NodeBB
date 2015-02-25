"use strict";

var async = require('async'),
	nconf = require('nconf'),
	meta = require('../meta'),
	groups = require('../groups'),
	user = require('../user'),
	helpers = require('./helpers'),
	groupsController = {};

groupsController.list = function(req, res, next) {
	groups.list({
		truncateUserList: true,
		expand: true,
		uid: req.user ? parseInt(req.user.uid, 10) : 0
	}, function(err, groups) {
		if (err) {
			return next(err);
		}
		res.render('groups/list', {
			groups: groups,
			allowGroupCreation: parseInt(meta.config.allowGroupCreation, 10) === 1
		});
	});
};

groupsController.details = function(req, res, next) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;

	async.waterfall([
		async.apply(groups.exists, res.locals.groupName),
		function(exists, next) {
			if (!exists) { return next(undefined, null); }

			// Ensure the group isn't hidden either
			groups.isHidden(res.locals.groupName, next);
		},
		function(hidden, next) {
			if (hidden === null) { return next(undefined, false); }		// Group didn't exist, not ok

			if (!hidden) {
				next(null, true);
			} else {
				// If not, only members are granted access
				async.parallel([
					async.apply(groups.isMember, uid, res.locals.groupName),
					async.apply(groups.isInvited, uid, res.locals.groupName)
				], function(err, checks) {
					next(err, checks[0] || checks[1]);
				});
			}
		}
	], function(err, ok) {
		if (ok) {
			async.parallel({
				group: function(next) {
					groups.get(res.locals.groupName, {
						expand: true,
						uid: uid
					}, next);
				},
				posts: function(next) {
					groups.getLatestMemberPosts(res.locals.groupName, 10, uid, next);
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
		} else {
			return res.locals.isAPI ? res.status(302).json('/groups') : res.redirect('/groups');
		}
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
