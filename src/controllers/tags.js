"use strict";


var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var meta = require('../meta');
var topics = require('../topics');
var helpers =  require('./helpers');

var tagsController = {};

tagsController.getTag = function(req, res, next) {
	var tag = validator.escape(req.params.tag);
	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;

	var templateData = {
		topics: [],
		tag: tag,
		breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]', url: '/tags'}, {text: tag}]),
		title: '[[pages:tag, ' + tag + ']]'
	};

	async.waterfall([
		function (next) {
			topics.getTagTids(req.params.tag, 0, stop, next);
		},
		function (tids, next) {
			if (Array.isArray(tids) && !tids.length) {
				topics.deleteTag(req.params.tag);
				return res.render('tag', templateData);
			}

			topics.getTopics(tids, req.uid, next);
		}
	], function(err, topics) {
		if (err) {
			return next(err);
		}

		res.locals.metaTags = [
			{
				name: 'title',
				content: tag
			},
			{
				property: 'og:title',
				content: tag
			},
			{
				property: 'og:url',
				content: nconf.get('url') + '/tags/' + tag
			}
		];
		templateData.topics = topics;
		templateData.nextStart = stop + 1;

		res.render('tag', templateData);
	});
};

tagsController.getTags = function(req, res, next) {
	topics.getTags(0, 99, function(err, tags) {
		if (err) {
			return next(err);
		}
		tags = tags.filter(function(tag) {
			return tag && tag.score > 0;
		});
		var data = {
			tags: tags,
			nextStart: 100,
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]'}]),
			title: '[[pages:tags]]'
		};
		res.render('tags', data);
	});
};

module.exports = tagsController;
