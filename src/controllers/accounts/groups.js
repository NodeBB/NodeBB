'use strict';


var async = require('async');

var groups = require('../../groups');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var groupsController = {};


groupsController.get = function (req, res, callback) {
	var userData;
	var groupsData;
	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			groups.getUserGroups([userData.uid], next);
		},
		function (_groupsData, next) {
			groupsData = _groupsData[0];
			var groupNames = groupsData.filter(Boolean).map(function (group) {
				return group.name;
			});

			groups.getMemberUsers(groupNames, 0, 3, next);
		},
		function (members, next) {
			groupsData.forEach(function (group, index) {
				group.members = members[index];
			});
			next();
		},
	], function (err) {
		if (err) {
			return callback(err);
		}

		userData.groups = groupsData;
		userData.title = '[[pages:account/groups, ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[global:header.groups]]' }]);
		res.render('account/groups', userData);
	});
};

module.exports = groupsController;
