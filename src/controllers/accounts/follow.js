'use strict';

var async = require('async');

var user = require('../../user');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');
var pagination = require('../../pagination');

var followController = {};

followController.getFollowing = function (req, res, next) {
	getFollow('account/following', 'following', req, res, next);
};

followController.getFollowers = function (req, res, next) {
	getFollow('account/followers', 'followers', req, res, next);
};

function getFollow(tpl, name, req, res, callback) {
	var userData;

	var page = parseInt(req.query.page, 10) || 1;
	var resultsPerPage = 50;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (data, next) {
			userData = data;
			if (!userData) {
				return callback();
			}
			var method = name === 'following' ? 'getFollowing' : 'getFollowers';
			user[method](userData.uid, start, stop, next);
		},
	], function (err, users) {
		if (err) {
			return callback(err);
		}

		userData.users = users;
		userData.title = '[[pages:' + tpl + ', ' + userData.username + ']]';
		var count = name === 'following' ? userData.followingCount : userData.followerCount;
		var pageCount = Math.ceil(count / resultsPerPage);
		userData.pagination = pagination.create(page, pageCount);
		userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:' + name + ']]' }]);

		res.render(tpl, userData);
	});
}

module.exports = followController;
