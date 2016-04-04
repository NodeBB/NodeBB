"use strict";

var async = require('async'),

	db = require('../../database'),
	groups = require('../../groups'),
	meta = require('../../meta'),
	pagination = require('../../pagination'),
	helpers = require('../helpers');


var groupsController = {};


groupsController.list = function(req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var groupsPerPage = 20;
	var pageCount = 0;

	async.waterfall([
		function(next) {
			db.getSortedSetRevRange('groups:createtime', 0, -1, next);
		},
		function(groupNames, next) {
			groupNames = groupNames.filter(function(name) {
				return name.indexOf(':privileges:') === -1 && name !== 'registered-users';
			});
			pageCount = Math.ceil(groupNames.length / groupsPerPage);

			var start = (page - 1) * groupsPerPage;
			var stop =  start + groupsPerPage - 1;

			groupNames = groupNames.slice(start, stop + 1);
			groups.getGroupsData(groupNames, next);
		},
		function(groupData, next) {
			next(null, {groups: groupData, pagination: pagination.create(page, pageCount)});
		}
	], function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/manage/groups', {
			groups: data.groups,
			pagination: data.pagination,
			yourid: req.user.uid
		});
	});
};

groupsController.get = function(req, res, callback) {
	var groupName = req.params.name;
	async.waterfall([
		function(next){
			groups.exists(groupName, next);
		},
		function(exists, next) {
			if (!exists) {
				return callback();
			}
			groups.get(groupName, {uid: req.uid, truncateUserList: true, userListCount: 20}, next);
		}
	], function(err, group) {
		if (err) {
			return callback(err);
		}
		group.isOwner = true;
		res.render('admin/manage/group', {group: group, allowPrivateGroups: parseInt(meta.config.allowPrivateGroups, 10) === 1});
	});
};

module.exports = groupsController;
