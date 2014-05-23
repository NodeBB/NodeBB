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

groupsController.details = function(req, res) {
	groups.get(req.params.name, {
		expand: true
	}, function(err, groupObj) {
		if (!err) {
			res.render('groups/details', groupObj);
		} else {
			res.redirect('404');
		}
	});
};

module.exports = groupsController;
