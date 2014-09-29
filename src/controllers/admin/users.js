"use strict";

var user = require('./../../user');


var usersController = {};

usersController.search = function(req, res, next) {
	res.render('admin/manage/users', {
		search_display: '',
		loadmore_display: 'none',
		users: []
	});
};

usersController.sortByPosts = function(req, res, next) {
	getUsers('users:postcount', req, res, next);
};

usersController.sortByReputation = function(req, res, next) {
	getUsers('users:reputation', req, res, next);
};

usersController.sortByJoinDate = function(req, res, next) {
	getUsers('users:joindate', req, res, next);
};

function getUsers(set, req, res, next) {
	user.getUsersFromSet(set, 0, 49, function(err, users) {
		if (err) {
			return next(err);
		}
		res.render('admin/manage/users', {
			search_display: 'hidden',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
}

usersController.getCSV = function(req, res, next) {
	user.getUsersCSV(function(err, data) {
		res.attachment('users.csv');
		res.setHeader('Content-Type', 'text/csv');
		res.end(data);
	});
};

module.exports = usersController;
