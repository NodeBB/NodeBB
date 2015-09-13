"use strict";

var async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),
	db = require('../database'),
	meta = require('../meta'),
	groups = require('../groups'),
	user = require('../user'),
	helpers = require('./helpers'),
	groupsController = {};

groupsController.list = function(req, res, next) {
	var sort = req.query.sort || 'alpha';

	groupsController.getGroupsFromSet(req.uid, sort, 0, 14, function(err, data) {
		if (err) {
			return next(err);
		}
		data.title = '[[pages:groups]]';
		data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[pages:groups]]'}]);
		res.render('groups/list', data);
	});
};

groupsController.getGroupsFromSet = function(uid, sort, start, stop, callback) {
	var set = 'groups:visible:name';
	if (sort === 'count') {
		set = 'groups:visible:memberCount';
	} else if (sort === 'date') {
		set = 'groups:visible:createtime';
	}

	groups.getGroupsFromSet(set, uid, start, stop, function(err, groups) {
		if (err) {
			return callback(err);
		}

		callback(null, {
			groups: groups,
			allowGroupCreation: parseInt(meta.config.allowGroupCreation, 10) === 1,
			nextStart: stop + 1
		});
	});
};

groupsController.details = function(req, res, callback) {
	async.waterfall([
		async.apply(groups.exists, res.locals.groupName),
		function(exists, next) {
			if (!exists) {
				return callback();
			}

			groups.isHidden(res.locals.groupName, next);
		},
		function(hidden, next) {
			if (!hidden) {
				return next();
			}

			async.parallel({
				isMember: async.apply(groups.isMember, req.uid, res.locals.groupName),
				isInvited: async.apply(groups.isInvited, req.uid, res.locals.groupName)
			}, function(err, checks) {
				if (err || checks.isMember || checks.isInvited) {
					return next(err);
				}
				callback();
			});
		}
	], function(err) {
		if (err) {
			return callback(err);
		}

		async.parallel({
			group: function(next) {
				groups.get(res.locals.groupName, {
					uid: req.uid,
					truncateUserList: true,
					userListCount: 20
				}, next);
			},
			posts: function(next) {
				groups.getLatestMemberPosts(res.locals.groupName, 10, req.uid, next);
			},
			isAdmin: async.apply(user.isAdministrator, req.uid)
		}, function(err, results) {
			if (err || !results.group) {
				return callback(err);
			}

			results.title = '[[pages:group, ' + results.group.displayName + ']]';
			results.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[pages:groups]]', url: '/groups' }, {text: results.group.displayName}]);
			res.render('groups/details', results);
		});
	});
};

groupsController.members = function(req, res, next) {
	var groupName;
	async.waterfall([
		function(next) {
			groups.getGroupNameByGroupSlug(req.params.slug, next);
		},
		function(_groupName, next) {
			groupName = _groupName;
			user.getUsersFromSet('group:' + groupName + ':members', req.uid, 0, 49, next);
		},
	], function(err, users) {
		if (err) {
			return next(err);
		}

		var breadcrumbs = helpers.buildBreadcrumbs([
			{text: '[[pages:groups]]', url: '/groups' },
			{text: validator.escape(groupName), url: '/groups/' + req.params.slug},
			{text: '[[groups:details.members]]'}
		]);

		res.render('groups/members', {
			users: users,
			nextStart: 50,
			loadmore_display: users.length > 50 ? 'block' : 'hide',
			breadcrumbs: breadcrumbs
		});
	});
};

module.exports = groupsController;
