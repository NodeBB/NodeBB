'use strict';

var async = require('async');

var topics = require('../../topics');

var tagsController = module.exports;

tagsController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			topics.getTags(0, 199, next);
		},
		function (tags) {
			res.render('admin/manage/tags', { tags: tags });
		},
	], next);
};
