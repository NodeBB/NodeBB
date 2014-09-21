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
	posts = require('../posts'),
	privileges = require('../privileges'),
	utils = require('./../../public/src/utils');

topicsController.get = function(req, res, next) {
	var tid = req.params.topic_id,
		page = req.query.page || 1,
		sort = req.query.sort,
		uid = req.user ? req.user.uid : 0,
		userPrivileges;

	async.waterfall([
		function (next) {
			privileges.topics.get(tid, uid, next);
		},
		function (privileges, next) {
			if (!privileges.read || privileges.disabled) {
				return next(new Error('[[error:no-privileges]]'));
			}

			userPrivileges = privileges;

			async.parallel({
				postCount: function(next) {
					topics.getPostCount(tid, next);
				},
				settings: function(next) {
					user.getSettings(uid, next);
				}
			}, next);
		},
		function (results, next) {
			var settings = results.settings;
			var postCount = parseInt(results.postCount, 10) + 1;
			var set = 'tid:' + tid + ':posts',
				reverse = false;

			// `sort` qs has priority over user setting
			if (sort === 'oldest_to_newest') {
				reverse = false;
			} else if (sort === 'newest_to_oldest') {
				reverse = true;
			} else if (sort === 'most_votes') {
				reverse = true;
				set = 'tid:' + tid + ':posts:votes';
			} else if (settings.topicPostSort === 'newest_to_oldest') {
				reverse = true;
			} else if (settings.topicPostSort === 'most_votes') {
				reverse = true;
				set = 'tid:' + tid + ':posts:votes';
			}

			var postIndex = 0;
			if (!settings.usePagination) {
				if (reverse) {
					if (!req.params.post_index || parseInt(req.params.post_index, 10) === 1) {
						req.params.post_index = 0;
					}
					postIndex = Math.max(postCount - (req.params.post_index || postCount) - (settings.postsPerPage - 1), 0);
				} else {
					postIndex = Math.max((req.params.post_index || 1) - (settings.postsPerPage + 1), 0);
				}
			} else if (!req.query.page) {
				var index = Math.max(parseInt(req.params.post_index, 10), 0) || 0;
				page = Math.ceil((index + 1) / settings.postsPerPage);
			}

			var start = (page - 1) * settings.postsPerPage + postIndex,
				end = start + settings.postsPerPage - 1;

			topics.getTopicWithPosts(tid, set, uid, start, end, reverse, function (err, topicData) {
				if (topicData) {
					if (topicData.deleted && !userPrivileges.view_deleted) {
						return next(new Error('[[error:no-topic]]'));
					}
					topicData.currentPage = page;
					if(page > 1) {
						topicData.posts.splice(0, 1);
					}
				}
				next(err, topicData);
			});
		},
		function (topicData, next) {
			var description = '';

			if (topicData.posts[0] && topicData.posts[0].content) {
				description = S(topicData.posts[0].content).stripTags().decodeHTMLEntities().s;
			}

			if (description.length > 255) {
				description = description.substr(0, 255) + '...';
			}

			description = validator.escape(description);

			var ogImageUrl = '';
			if (topicData.thumb) {
				ogImageUrl = topicData.thumb;
			} else if(topicData.posts.length && topicData.posts[0] && topicData.posts[0].user && topicData.posts[0].user.picture){
				ogImageUrl = topicData.posts[0].user.picture;
			} else if(meta.config['brand:logo']) {
				ogImageUrl = meta.config['brand:logo'];
			} else {
				ogImageUrl = '/logo.png';
			}

			if (ogImageUrl.indexOf('http') === -1) {
				ogImageUrl = nconf.get('url') + ogImageUrl;
			}

			description = description.replace(/\n/g, ' ');

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
					property: 'og:image',
					content: ogImageUrl
				},
				{
					property: "og:image:url",
					content: ogImageUrl
				},
				{
					property: "article:published_time",
					content: utils.toISOString(topicData.timestamp)
				},
				{
					property: 'article:modified_time',
					content: utils.toISOString(topicData.lastposttime)
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
				},
				{
					rel: 'canonical',
					href: nconf.get('url') + '/topic/' + topicData.slug
				}
			];

			next(null, topicData);
		}
	], function (err, data) {
		if (err) {
			return res.locals.isAPI ? res.json(404, 'not-found') : res.redirect(nconf.get('relative_path') + '/404');
		}

		data.privileges = userPrivileges;
		data['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;
		data['downvote:disabled'] = parseInt(meta.config['downvote:disabled'], 10) === 1;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;

		var topic_url = tid + (req.params.slug ? '/' + req.params.slug : '');
		var queryString = qs.stringify(req.query);
		if(queryString.length) {
			topic_url += '?' + queryString;
		}

		// Paginator for noscript
		data.pages = [];
		for(var x=1; x<=data.pageCount; x++) {
			data.pages.push({
				page: x,
				active: x === parseInt(page, 10)
			});
		}
		res.render('topic', data);
	});
};

topicsController.teaser = function(req, res, next) {
	var tid = req.params.topic_id;
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;
	topics.getLatestUndeletedPid(tid, function(err, pid) {
		if (err) {
			return next(err);
		}

		if (!pid) {
			return res.json(404, 'not-found');
		}

		posts.getPostSummaryByPids([pid], uid, {stripTags: false}, function(err, posts) {
			if (err) {
				return next(err);
			}

			if (!Array.isArray(posts) || !posts.length) {
				return res.json(404, 'not-found');
			}

			res.json(posts[0]);
		});
	});
};

module.exports = topicsController;
