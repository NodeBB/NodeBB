"use strict";

var async = require('async'),
	groups = require('../../groups'),
	meta = require('../../meta'),
	helpers = require('../helpers');


var groupsController = {};


groupsController.list = function(req, res, next) {
	groups.getGroupsFromSet('groups:createtime', req.uid, 0, -1, function(err, groups) {
		if (err) {
			return next(err);
		}

		groups = groups.filter(function(group) {
			return group && group.name.indexOf(':privileges:') === -1 && group.name !== 'registered-users';
		});

		res.render('admin/manage/groups', {
			groups: groups,
			yourid: req.user.uid
		});
	});
};

groupsController.get = function(req, res, next) {
	var groupName = req.params.name;
	async.waterfall([
		function(next){
			groups.exists(groupName, next);
		},
		function(exists, next) {
			if (!exists) {
				return helpers.notFound(req, res);
			}
			groups.get(groupName, {uid: req.uid}, next);
		}
	], function(err, group) {
		if (err) {
			return next(err);
		}
		res.render('admin/manage/group', {group: group});
	});
};

module.exports = groupsController;
