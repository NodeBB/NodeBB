'use strict';

var async = require('async'),

	user = require('../../user'),
	helpers = require('../helpers'),
	accountHelpers = require('./helpers');

var followController = {};

followController.getFollowing = function(req, res, next) {
	getFollow('account/following', 'following', req, res, next);
};

followController.getFollowers = function(req, res, next) {
	getFollow('account/followers', 'followers', req, res, next);
};

function getFollow(tpl, name, req, res, callback) {
	var userData;

	async.waterfall([
		function(next) {
			accountHelpers.getBaseUser(req.params.userslug, req.uid, next);
		},
		function(data, next) {
			userData = data;
			if (!userData) {
				return callback();
			}
			var method = name === 'following' ? 'getFollowing' : 'getFollowers';
			user[method](userData.uid, 0, 49, next);
		}
	], function(err, users) {
		if (err) {
			return callback(err);
		}

		userData.users = users;
		userData.nextStart = 50;
		userData.title = '[[pages:' + tpl + ', ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:' + name + ']]'}]);

		res.render(tpl, userData);
	});
}

module.exports = followController;