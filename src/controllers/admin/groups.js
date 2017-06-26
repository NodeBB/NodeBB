'use strict';

var async = require('async');

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
			db.getSortedSetRange('groups:createtime', 0, -1, next);
		},
		function (groupNames, next) {
			groupNames = groupNames.filter(function (name) {
				return name.indexOf(':privileges:') === -1 && name !== 'registered-users';
			});
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
			groups.exists(groupName, next);
		},
		function (exists, next) {
			if (!exists) {
				return callback();
			}
			groups.get(groupName, { uid: req.uid, truncateUserList: true, userListCount: 20 }, next);
		},
		function (group) {
			group.isOwner = true;
			res.render('admin/manage/group', {
				group: group,
				allowPrivateGroups: parseInt(meta.config.allowPrivateGroups, 10) === 1,
			});
		},
	], callback);
};
