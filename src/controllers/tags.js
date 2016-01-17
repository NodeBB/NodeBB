"use strict";

var tagsController = {},
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),
	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	helpers =  require('./helpers');

tagsController.getTag = function(req, res, next) {
	var tag = validator.escape(req.params.tag);
	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;

	async.waterfall([
		function(next) {
			topics.getTagTids(req.params.tag, 0, stop, next);
		},
		function(tids, next) {
			if (Array.isArray(tids) && !tids.length) {
				topics.deleteTag(req.params.tag);
				return res.render('tag', {
					topics: [],
					tag: tag,
					breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]', url: '/tags'}, {text: tag}])
				});
			}

			async.parallel({
				isAdmin: async.apply(user.isAdministrator, req.uid),
				topics: async.apply(topics.getTopics, tids, req.uid)
			}, next);
		}
	], function(err, results) {
		if (err) {
			return next(err);
		}

		if (!results.isAdmin) {
			results.topics = results.topics.filter(function(topic) {
				return topic && !topic.deleted;
			});
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
			topics: results.topics,
			tag: tag,
			nextStart: stop + 1,
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]', url: '/tags'}, {text: tag}]),
			title: '[[pages:tag, ' + tag + ']]'
		};
		res.render('tag', data);
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
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[tags:tags]]'}]),
			title: '[[pages:tags]]'
		};
		res.render('tags', data);
	});
};

module.exports = tagsController;
