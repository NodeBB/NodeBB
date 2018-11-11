'use strict';

var async = require('async');
const _ = require('lodash');

var navigationAdmin = require('../../navigation/admin');
const groups = require('../../groups');

var navigationController = module.exports;

navigationController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				admin: async.apply(navigationAdmin.getAdmin),
				groups: async.apply(groups.getNonPrivilegeGroups, 'groups:createtime', 0, -1),
			}, next);
		},
		function (result) {
			result.admin.enabled.forEach(function (enabled, index) {
				enabled.index = index;
				enabled.selected = index === 0;
				const groupData = _.cloneDeep(result.groups);

				enabled.groups = groupData.map(function (group) {
					group.selected = enabled.groups.includes(group.name);
					return group;
				});

				enabled.groups.sort((a, b) => b.system - a.system);
			});

			result.admin.navigation = result.admin.enabled.slice();

			res.render('admin/general/navigation', result.admin);
		},
	], next);
};
