"use strict";

var async = require('async'),
	nconf = require('nconf'),
	meta = require('../meta'),
	groups = require('../groups'),
	user = require('../user'),
	helpers = require('./helpers'),
	groupsController = {};

groupsController.list = function(req, res, next) {
	groups.list(req.uid, 0, -1, function(err, groups) {
		if (err) {
			return next(err);
		}

		groups = groups.filter(function(group) {
			return group && !group.hidden && !group.system;
		});

		res.render('groups/list', {
			groups: groups,
			allowGroupCreation: parseInt(meta.config.allowGroupCreation, 10) === 1
		});
	});
};

groupsController.details = function(req, res, next) {
	async.waterfall([
		async.apply(groups.exists, res.locals.groupName),
		function(exists, next) {
			if (!exists) {
				return next(undefined, null);
			}

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
					async.apply(groups.isMember, req.uid, res.locals.groupName),
					async.apply(groups.isInvited, req.uid, res.locals.groupName)
				], function(err, checks) {
					next(err, checks[0] || checks[1]);
				});
			}
		}
	], function(err, ok) {
		if (err) {
			return next(err);
		}

		if (!ok) {
			return helpers.redirect(res, '/groups');
		}

		async.parallel({
			group: function(next) {
				groups.get(res.locals.groupName, {
					uid: req.uid
				}, next);
			},
			posts: function(next) {
				groups.getLatestMemberPosts(res.locals.groupName, 10, req.uid, next);
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
	});
};

groupsController.members = function(req, res, next) {
	async.waterfall([
		function(next) {
			groups.getGroupNameByGroupSlug(req.params.slug, next);
		},
		function(groupName, next) {
			user.getUsersFromSet('group:' + groupName + ':members', req.uid, 0, 49, next);
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
