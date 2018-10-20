'use strict';

var async = require('async');

var helpers = require('../helpers');
var accountHelpers = require('./helpers');
var pagination = require('../../pagination');
var user = require('../../user');
var plugins = require('../../plugins');

var blocksController = module.exports;

blocksController.getBlocks = function (req, res, callback) {
	var userData;

	var page = parseInt(req.query.page, 10) || 1;
	var resultsPerPage = 50;
	var start = Math.max(0, page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			user.blocks.list(res.locals.uid, next);
		},
		function (uids, next) {
			plugins.fireHook('filter:user.getBlocks', {
				uids: uids,
				uid: res.locals.uid,
				start: start,
				stop: stop,
			}, next);
		},
		function (data, next) {
			user.getUsers(data.uids, res.locals.uid, next);
		},
		function (users) {
			userData.users = users;
			userData.title = '[[pages:account/blocks, ' + userData.username + ']]';
			var count = userData.blocksCount;
			var pageCount = Math.ceil(count / resultsPerPage);
			userData.pagination = pagination.create(page, pageCount);
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:blocks]]' }]);

			res.render('account/blocks', userData);
		},
	], callback);
};
