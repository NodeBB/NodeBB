'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var topics = require('../../topics');
var categories = require('../../categories');
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
		function (userData, next) {
			postData.forEach(function (postData, index) {
				postData.user = userData[index];
			});

			async.map(postData, function (postData, next) {
				async.waterfall([
					function (next) {
						if (postData.data.cid) {
							next(null, { cid: postData.data.cid });
						} else if (postData.data.tid) {
							topics.getTopicFields(postData.data.tid, ['title', 'cid'], next);
						} else {
							next(null, { cid: 0 });
						}
					},
					function (topicData, next) {
						postData.topic = topicData;
						categories.getCategoryData(topicData.cid, next);
					},
					function (categoryData, next) {
						postData.category = categoryData;
						next(null, postData);
					},
				], next);
			}, next);
		},
		function (postData) {
			res.render('admin/manage/post-queue', {
				title: '[[pages:post-queue]]',
				posts: postData,
				pagination: pagination.create(page, pageCount),
			});
		},
	], next);
};
