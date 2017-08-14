'use strict';

var async = require('async');

var db = require('../../database');

var pagination = require('../../pagination');

var postQueueController = module.exports;

postQueueController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var postsPerPage = 20;
	var pageCount = 0;

	var start = (page - 1) * postsPerPage;
	var stop = start + postsPerPage - 1;

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
		function (data) {
			data.forEach(function (data) {
				data.data = JSON.parse(data.data);
				return data;
			});

			res.render('admin/manage/post-queue', {
				title: '[[pages:post-queue]]',
				posts: data,
				pagination: pagination.create(page, pageCount),
			});
		},
	], next);
};
