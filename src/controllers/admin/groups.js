'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../../database');
var groups = require('../../groups');
var meta = require('../../meta');
var pagination = require('../../pagination');

var groupsController = module.exports;

groupsController.list = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var groupsPerPage = 20;
	var pageCount = 0;

	async.waterfall([
		function (next) {
			getGroupNames(next);
		},
		function (groupNames, next) {
			pageCount = Math.ceil(groupNames.length / groupsPerPage);

			var start = (page - 1) * groupsPerPage;
			var stop = start + groupsPerPage - 1;

			groupNames = groupNames.slice(start, stop + 1);
			groups.getGroupsData(groupNames, next);
		},
		function (groupData) {
			res.render('admin/manage/groups', {
				groups: groupData,
				pagination: pagination.create(page, pageCount),
				yourid: req.uid,
			});
		},
	], next);
};

groupsController.get = function (req, res, callback) {
	var groupName = req.params.name;
	async.waterfall([
		function (next) {
			async.parallel({
				groupNames: function (next) {
					getGroupNames(next);
				},
				group: function (next) {
					groups.get(groupName, { uid: req.uid, truncateUserList: true, userListCount: 20 }, next);
				},
			}, next);
		},
		function (result) {
			if (!result.group) {
				return callback();
			}
			result.group.isOwner = true;

			result.groupNames = result.groupNames.map(function (name) {
				return {
					encodedName: encodeURIComponent(name),
					displayName: validator.escape(String(name)),
					selected: name === groupName,
				};
			});

			res.render('admin/manage/group', {
				group: result.group,
				groupNames: result.groupNames,
				allowPrivateGroups: meta.config.allowPrivateGroups,
				maximumGroupNameLength: meta.config.maximumGroupNameLength,
				maximumGroupTitleLength: meta.config.maximumGroupTitleLength,
			});
		},
	], callback);
};

function getGroupNames(callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('groups:createtime', 0, -1, next);
		},
		function (groupNames, next) {
			groupNames = groupNames.filter(function (name) {
				return name !== 'registered-users' && !groups.isPrivilegeGroup(name);
			});
			next(null, groupNames);
		},
	], callback);
}
