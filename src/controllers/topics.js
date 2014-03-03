"use strict";

var topicsController = {},
	async = require('async'),
	S = require('string'),
	validator = require('validator'),
	nconf = require('nconf'),
	qs = require('querystring'),
	user = require('./../user'),
	meta = require('./../meta'),
	topics = require('./../topics'),
	threadTools = require('./../threadTools'),
	utils = require('./../../public/src/utils');

topicsController.get = function(req, res, next) {
	var tid = req.params.topic_id,
		page = req.query.page || 1,
		uid = req.user ? req.user.uid : 0;

	async.waterfall([
		function(next) {
			threadTools.privileges(tid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
				if (!err) {
					if (!privileges.read) {
						next(new Error('not-enough-privileges'));
					} else {
						next();
					}
				} else {
					next(err);
				}
			});
		},
		function (next) {
			user.getSettings(uid, function(err, settings) {
				if (err) {
					return next(err);
				}

				var start = (page - 1) * settings.topicsPerPage,
					end = start + settings.topicsPerPage - 1;

				topics.getTopicWithPosts(tid, uid, start, end, function (err, topicData) {
					if (topicData) {
						if (parseInt(topicData.deleted, 10) === 1 && parseInt(topicData.expose_tools, 10) === 0) {
							return next(new Error('Topic deleted'), null);
						}
					}

					next(err, topicData);
				});
			});
		},
		function (topicData, next) {
			var lastMod = topicData.timestamp,
				description = (function() {
					var	content = '';
					if(topicData.posts.length) {
						content = S(topicData.posts[0].content).stripTags().s;
					}

					if (content.length > 255) {
						content = content.substr(0, 255) + '...';
					}

					return validator.escape(content);
				})(),
				timestamp;

			for (var x = 0, numPosts = topicData.posts.length; x < numPosts; x++) {
				timestamp = parseInt(topicData.posts[x].timestamp, 10);
				if (timestamp > lastMod) {
					lastMod = timestamp;
				}
			}

			var ogImageUrl = meta.config['brand:logo'];
			if(ogImageUrl && ogImageUrl.indexOf('http') === -1) {
				ogImageUrl = nconf.get('url') + ogImageUrl;
			}

			res.locals.metaTags = [
				{
					name: "title",
					content: topicData.title
				},
				{
					name: "description",
					content: description
				},
				{
					property: 'og:title',
					content: topicData.title
				},
				{
					property: 'og:description',
					content: description
				},
				{
					property: "og:type",
					content: 'article'
				},
				{
					property: "og:url",
					content: nconf.get('url') + '/topic/' + topicData.slug
				},
				{
					property: "og:image:url",
					content: ogImageUrl
				},
				{
					property: 'og:image',
					content: topicData.posts.length?topicData.posts[0].picture:''
				},
				{
					property: "article:published_time",
					content: utils.toISOString(topicData.timestamp)
				},
				{
					property: 'article:modified_time',
					content: utils.toISOString(lastMod)
				},
				{
					property: 'article:section',
					content: topicData.category.name
				}
			];

			res.locals.linkTags = [
				{
					rel: 'alternate',
					type: 'application/rss+xml',
					href: nconf.get('url') + '/topic/' + tid + '.rss'
				},
				{
					rel: 'up',
					href: nconf.get('url') + '/category/' + topicData.category.slug
				}
			];
			
			next(null, topicData);
		}
	], function (err, posts) {
		if (err) {
			if (err.message === 'not-enough-privileges') {
				return res.redirect('403');
			} else {
				return res.redirect('404');
			}
		}

		var topic_url = tid + (req.params.slug ? '/' + req.params.slug : '');
		var queryString = qs.stringify(req.query);
		if(queryString.length) {
			topic_url += '?' + queryString;
		}

		// Paginator for noscript
		posts.pages = [];
		for(var x=1;x<=posts.pageCount;x++) {
			posts.pages.push({
				page: x,
				active: x === parseInt(page, 10)
			});
		}

		if (res.locals.isAPI) {
			res.json(posts);
		} else {
			res.render('topic', posts);
		}
	});
};

module.exports = topicsController;