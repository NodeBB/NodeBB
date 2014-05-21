"use strict";

var tagsController = {},
	async = require('async'),
	topics = require('./../topics');

tagsController.getTag = function(req, res, next) {
	var tag = req.params.tag;
	var uid = req.user ? req.user.uid : 0;

	topics.getTagTids(tag, 0, 19, function(err, tids) {
		if (err) {
			return next(err);
		}

		topics.getTopics('tag:' + tag + ':topics', uid, tids, function(err, data) {
			if (err) {
				return next(err);
			}
			data.tag = tag;
			res.render('tag', data);
		});
	});
};

tagsController.getTags = function(req, res, next) {
	topics.getTagsObjects(function(err, tags) {
		if (err) {
			return next(err);
		}

		async.map(tags, function(tag, next) {
			topics.getTagTopicCount(tag.name, function(err, count) {
				if (err) {
					return next(err);
				}
				tag.topicCount = count;
				next(null, tag);
			});
		}, function(err, tags) {
			if (err) {
				return next(err);
			}
			tags = tags.sort(function(a, b) {
				return parseInt(b.topicCount, 10) - parseInt(a.topicCount, 10);
			});
			res.render('tags', {tags: tags});
		});
	});

};

module.exports = tagsController;
