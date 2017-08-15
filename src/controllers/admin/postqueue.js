'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var pagination = require('../../pagination');
var utils = require('../../utils');

var postQueueController = module.exports;

postQueueController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var postsPerPage = 20;
	var pageCount = 0;

	var start = (page - 1) * postsPerPage;
	var stop = start + postsPerPage - 1;

	var postData;

	async.waterfall([
		function (next) {
			async.parallel({
				count: function (next) {
					db.sortedSetCard('post:queue', next);
				},
				ids: function (next) {
					db.getSortedSetRange('post:queue', start, stop, next);
				},
			}, next);
		},
		function (results, next) {
			pageCount = Math.ceil(results.count / postsPerPage);

			var keys = results.ids.map(function (id) {
				return 'post:queue:' + id;
			});

			db.getObjects(keys, next);
		},
		function (data, next) {
			postData = data;
			data.forEach(function (data) {
				data.data = JSON.parse(data.data);
				data.data.timestampISO = utils.toISOString(data.data.timestamp);
				return data;
			});
			var uids = data.map(function (data) {
				return data && data.uid;
			});
			user.getUsersFields(uids, ['username', 'userslug', 'picture'], next);
		},
		function (userData) {
			postData.forEach(function (postData, index) {
				postData.user = userData[index];
			});

			res.render('admin/manage/post-queue', {
				title: '[[pages:post-queue]]',
				posts: postData,
				pagination: pagination.create(page, pageCount),
			});
		},
	], next);
};
