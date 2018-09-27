'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../../database');
var user = require('../../user');
var topics = require('../../topics');
var categories = require('../../categories');
var pagination = require('../../pagination');
var plugins = require('../../plugins');
var utils = require('../../utils');

var postQueueController = module.exports;

postQueueController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var postsPerPage = 20;
	var results;
	async.waterfall([
		function (next) {
			async.parallel({
				ids: function (next) {
					db.getSortedSetRange('post:queue', 0, -1, next);
				},
				isAdminOrGlobalMod: function (next) {
					user.isAdminOrGlobalMod(req.uid, next);
				},
				moderatedCids: function (next) {
					user.getModeratedCids(req.uid, next);
				},
			}, next);
		},
		function (_results, next) {
			results = _results;
			getQueuedPosts(results.ids, next);
		},
		function (postData) {
			postData = postData.filter(function (postData) {
				return postData && (results.isAdminOrGlobalMod || results.moderatedCids.includes(String(postData.category.cid)));
			});

			var pageCount = Math.max(1, Math.ceil(postData.length / postsPerPage));
			var start = (page - 1) * postsPerPage;
			var stop = start + postsPerPage - 1;
			postData = postData.slice(start, stop + 1);

			res.render('admin/manage/post-queue', {
				title: '[[pages:post-queue]]',
				posts: postData,
				pagination: pagination.create(page, pageCount),
			});
		},
	], next);
};

function getQueuedPosts(ids, callback) {
	var keys = ids.map(function (id) {
		return 'post:queue:' + id;
	});
	var postData;
	async.waterfall([
		function (next) {
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
				postData.data.rawContent = validator.escape(String(postData.data.content));
				postData.data.title = validator.escape(String(postData.data.title));
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
						plugins.fireHook('filter:parse.post', { postData: postData.data }, next);
					},
					function (result, next) {
						postData.data.content = result.postData.content;
						next(null, postData);
					},
				], next);
			}, next);
		},
	], callback);
}
