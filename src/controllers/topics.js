"use strict";

var topicsController = {},
	async = require('async'),
	S = require('string'),
	validator = require('validator'),
	nconf = require('nconf'),
	qs = require('querystring'),
	user = require('../user'),
	meta = require('../meta'),
	topics = require('../topics'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	helpers = require('./helpers'),
	pagination = require('../pagination'),
	utils = require('../../public/src/utils');

topicsController.get = function(req, res, next) {
	var tid = req.params.topic_id,
		page = 1,
		sort = req.query.sort,
		uid = req.user ? req.user.uid : 0,
		userPrivileges;

	if (req.params.post_index && !utils.isNumber(req.params.post_index)) {
		return helpers.notFound(req, res);
	}

	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function(next) {
					privileges.topics.get(tid, uid, next);
				},
				settings: function(next) {
					user.getSettings(uid, next);
				},
				topic: function(next) {
					topics.getTopicFields(tid, ['slug', 'postcount', 'deleted'], next);
				}
			}, next);
		},
		function (results, next) {
			userPrivileges = results.privileges;

			if (userPrivileges.disabled || tid + '/' + req.params.slug !== results.topic.slug) {
				return helpers.notFound(req, res);
			}

			if (!userPrivileges.read || (parseInt(results.topic.deleted, 10) && !userPrivileges.view_deleted)) {
				return helpers.notAllowed(req, res);
			}

			var settings = results.settings;
			var postCount = parseInt(results.topic.postcount, 10);
			var pageCount = Math.max(1, Math.ceil((postCount - 1) / settings.postsPerPage));

			if (utils.isNumber(req.params.post_index)) {
				var url = '';
				if (req.params.post_index < 1 || req.params.post_index > postCount) {
					url = '/topic/' + req.params.topic_id + '/' + req.params.slug + (req.params.post_index > postCount ? '/' + postCount : '');
					return res.locals.isAPI ? res.status(302).json(url) : res.redirect(url);
				}
			}

			if (settings.usePagination && (req.query.page < 1 || req.query.page > pageCount)) {
				return helpers.notFound(req, res);
			}

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
			page = parseInt(req.query.page, 10) || 1;
			req.params.post_index = parseInt(req.params.post_index, 10) || 0;
			if (reverse && req.params.post_index === 1) {
				req.params.post_index = 0;
			}
			if (!settings.usePagination) {
				if (reverse) {
					postIndex = Math.max(0, postCount - (req.params.post_index || postCount) - (settings.postsPerPage - 1));
				} else {
					postIndex = Math.max(0, (req.params.post_index || 1) - (settings.postsPerPage + 1));
				}
			} else if (!req.query.page) {
				var index = 0;
				if (reverse) {
					index = Math.max(0, postCount - (req.params.post_index || postCount));
				} else {
					index = Math.max(0, req.params.post_index - 1) || 0;
				}

				page = Math.max(1, Math.ceil(index / settings.postsPerPage));
			}

			var start = (page - 1) * settings.postsPerPage + postIndex,
				end = start + settings.postsPerPage - 1;

			topics.getTopicWithPosts(tid, set, uid, start, end, reverse, function (err, topicData) {
				if (err && err.message === '[[error:no-topic]]' && !topicData) {
					return helpers.notFound(req, res);
				}

				if (err && !topicData) {
					return next(err);
				}

				topicData.pageCount = pageCount;
				topicData.currentPage = page;

				if (page > 1) {
					topicData.posts.splice(0, 1);
				}

				plugins.fireHook('filter:controllers.topic.get', topicData, next);
			});
		},
		function (topicData, next) {
			var breadcrumbs = [
				{
					text: topicData.category.name,
					url: nconf.get('relative_path') + '/category/' + topicData.category.slug
				},
				{
					text: topicData.title,
					url: nconf.get('relative_path') + '/topic/' + topicData.slug
				}
			];

			helpers.buildCategoryBreadcrumbs(topicData.category.parentCid, function(err, crumbs) {
				if (err) {
					return next(err);
				}
				topicData.breadcrumbs = crumbs.concat(breadcrumbs);
				next(null, topicData);
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
			description = description.replace(/&apos;/g, '&#x27;');

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
					content: topicData.title.replace(/&amp;/g, '&')
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
					content: topicData.category ? topicData.category.name : ''
				}
			];

			res.locals.linkTags = [
				{
					rel: 'alternate',
					type: 'application/rss+xml',
					href: nconf.get('url') + '/topic/' + tid + '.rss'
				},
				{
					rel: 'canonical',
					href: nconf.get('url') + '/topic/' + topicData.slug
				}
			];

			if (topicData.category) {
				res.locals.linkTags.push({
					rel: 'up',
					href: nconf.get('url') + '/category/' + topicData.category.slug
				});
			}

			next(null, topicData);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.privileges = userPrivileges;
		data['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;
		data['downvote:disabled'] = parseInt(meta.config['downvote:disabled'], 10) === 1;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data['rssFeedUrl'] = nconf.get('relative_path') + '/topic/' + data.tid + '.rss';
		data.pagination = pagination.create(data.currentPage, data.pageCount);
		data.pagination.rel.forEach(function(rel) {
			res.locals.linkTags.push(rel);
		});

		topics.increaseViewCount(tid);
		res.render('topic', data);
	});
};

topicsController.teaser = function(req, res, next) {
	var tid = req.params.topic_id;
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;

	if (!utils.isNumber(tid)) {
		return next(new Error('[[error:invalid-tid]]'));
	}

	privileges.topics.can('read', tid, uid, function(err, canRead) {
		if (err) {
			return next(err);
		}

		if (!canRead) {
			return res.status(403).json('[[error:no-privileges]]');
		}

		topics.getLatestUndeletedPid(tid, function(err, pid) {
			if (err) {
				return next(err);
			}

			if (!pid) {
				return res.status(404).json('not-found');
			}

			posts.getPostSummaryByPids([pid], uid, {stripTags: false}, function(err, posts) {
				if (err) {
					return next(err);
				}

				if (!Array.isArray(posts) || !posts.length) {
					return res.status(404).json('not-found');
				}

				res.json(posts[0]);
			});
		});
	});
};

module.exports = topicsController;
