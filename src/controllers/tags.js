"use strict";

var tagsController = {},
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),
	meta = require('../meta'),
	topics = require('../topics'),
	helpers =  require('./helpers');

tagsController.getTag = function(req, res, next) {
	var tag = validator.escape(req.params.tag);
	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;

	topics.getTagTids(tag, 0, stop, function(err, tids) {
		if (err) {
			return next(err);
		}

		if (Array.isArray(tids) && !tids.length) {
			topics.deleteTag(tag);
			return res.render('tag', {topics: [], tag: tag});
		}

		topics.getTopics(tids, req.uid, function(err, topics) {
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
			var data = {
				topics: topics,
				tag: tag,
				nextStart: stop + 1,
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]', url: '/tags'}, {text: tag}])
			};
			res.render('tag', data);
		});
	});
};

tagsController.getTags = function(req, res, next) {
	topics.getTags(0, 99, function(err, tags) {
		if (err) {
			return next(err);
		}
		var data = {
			tags: tags,
			nextStart: 100,
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]'}])
		};
		res.render('tags', data);
	});
};

module.exports = tagsController;
