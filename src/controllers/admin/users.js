"use strict";

var user = require('./../../user');


var usersController = {};

usersController.search = function(req, res, next) {
	res.render('admin/users', {
		search_display: 'block',
		loadmore_display: 'none',
		users: []
	});
};

usersController.latest = function(req, res, next) {
	user.getUsers('users:joindate', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
};

usersController.sortByPosts = function(req, res, next) {
	user.getUsers('users:postcount', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
};

usersController.sortByReputation = function(req, res, next) {
	user.getUsers('users:reputation', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
};

usersController.sortByJoinDate = function(req, res, next) {
	user.getUsers('users:joindate', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			users: users,
			yourid: req.user.uid
		});
	});
};

usersController.getCSV = function(req, res, next) {
	user.getUsersCSV(function(err, data) {
		res.attachment('users.csv');
		res.setHeader('Content-Type', 'text/csv');
		res.end(data);
	});
};

module.exports = usersController;