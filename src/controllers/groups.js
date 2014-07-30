"use strict";

var groups = require('../groups'),
	async = require('async'),

	groupsController = {};

groupsController.list = function(req, res) {
	groups.list({
		truncateUserList: true,
		expand: true
	}, function(err, groups) {
		res.render('groups/list', {
			groups: groups
		});
	});
};

groupsController.details = function(req, res) {
	async.parallel({
		group: function(next) {
			groups.get(req.params.name, {
				expand: true
			}, next);
		},
		posts: function(next) {
			groups.getLatestMemberPosts(req.params.name, 10, next);
		}
	}, function(err, results) {
		if (!err) {
			res.render('groups/details', results);
		} else {
			res.redirect(nconf.get('relative_path') + '/404')
		}
	});
};

module.exports = groupsController;
