"use strict";

var groups = require('../groups'),

	groupsController = {};

groupsController.list = function(req, res) {
	groups.list({
		truncateUserList: true,
		expand: true
	}, function(err, groups) {
		console.log(groups);
		res.render('groups/list', {
			groups: groups
		});
	});
};

module.exports = groupsController;
