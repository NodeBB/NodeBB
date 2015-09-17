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

topicsController.get = function(req, res, callback) {
	var tid = req.params.topic_id,
		sort = req.query.sort,
		userPrivileges;

	if ((req.params.post_index && !utils.isNumber(req.params.post_index)) || !utils.isNumber(tid)) {
		return callback();
	}

	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function(next) {
					privileges.topics.get(tid, req.uid, next);
				},
				settings: function(next) {
					user.getSettings(req.uid, next);
				},
				topic: function(next) {
					topics.getTopicFields(tid, ['slug', 'postcount', 'deleted'], next);
				}
			}, next);
		},
		function (results, next) {

			if (!results.topic.slug) {
				return callback();
			}

			userPrivileges = results.privileges;

			if (!userPrivileges.read || (parseInt(results.topic.deleted, 10) && !userPrivileges.view_deleted)) {
				return helpers.notAllowed(req, res);
			}

			if ((!req.params.slug || results.topic.slug !== tid + '/' + req.params.slug) && (results.topic.slug && results.topic.slug !== tid + '/')) {
				return helpers.redirect(res, '/topic/' + encodeURI(results.topic.slug));
			}

			var settings = results.settings;
			var postCount = parseInt(results.topic.postcount, 10);
			var pageCount = Math.max(1, Math.ceil((postCount - 1) / settings.postsPerPage));
			var page = parseInt(req.query.page, 10) || 1;

			if (utils.isNumber(req.params.post_index) && (req.params.post_index < 1 || req.params.post_index > postCount)) {
				return helpers.redirect(res, '/topic/' + req.params.topic_id + '/' + req.params.slug + (req.params.post_index > postCount ? '/' + postCount : ''));
			}

			if (settings.usePagination && (page < 1 || page > pageCount)) {
				return callback();
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

			var postIndex = 0,
				index = 0;

			req.params.post_index = parseInt(req.params.post_index, 10) || 0;
			if (reverse && req.params.post_index === 1) {
				req.params.post_index = 0;
			}
			if (!settings.usePagination) {
				if (reverse) {
					postIndex = Math.max(0, postCount - (req.params.post_index || postCount) - Math.ceil(settings.postsPerPage / 2));
				} else {
					postIndex = Math.max(0, (req.params.post_index || 1) - Math.ceil(settings.postsPerPage / 2));
				}
			} else if (!req.query.page) {
				if (reverse) {
					index = Math.max(0, postCount - (req.params.post_index || postCount));
				} else {
					index = Math.max(0, req.params.post_index - 1) || 0;
				}

				page = Math.max(1, Math.ceil(index / settings.postsPerPage));
			}

			var start = (page - 1) * settings.postsPerPage + postIndex,
				stop = start + settings.postsPerPage - 1;

			topics.getTopicWithPosts(tid, set, req.uid, start, stop, reverse, function (err, topicData) {
				if (err && err.message === '[[error:no-topic]]' && !topicData) {
					return callback();
				}

				if (err && !topicData) {
					return next(err);
				}

				topicData.pageCount = pageCount;
				topicData.currentPage = page;
				topicData.postIndex = postIndex || index || req.params.post_index;

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
			var description = '',
				idx = topicData.postIndex;

			if (topicData.posts[idx] && topicData.posts[idx].content) {
				description = S(topicData.posts[idx].content).stripTags().decodeHTMLEntities().s;
			}

			if (description.length > 255) {
				description = description.substr(0, 255) + '...';
			}

			description = validator.escape(description);
			description = description.replace(/&apos;/g, '&#x27;');

			var ogImageUrl = '';
			if (topicData.thumb) {
				ogImageUrl = topicData.thumb;
			} else if(topicData.posts.length && topicData.posts[idx] && topicData.posts[idx].user && topicData.posts[idx].user.picture){
				ogImageUrl = topicData.posts[idx].user.picture;
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
			return callback(err);
		}

		data.privileges = userPrivileges;
		data['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;
		data['downvote:disabled'] = parseInt(meta.config['downvote:disabled'], 10) === 1;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/topic/' + data.tid + '.rss';
		data.pagination = pagination.create(data.currentPage, data.pageCount);
		data.pagination.rel.forEach(function(rel) {
			res.locals.linkTags.push(rel);
		});

		topics.increaseViewCount(tid);

		plugins.fireHook('filter:topic.build', {req: req, res: res, templateData: data}, function(err, data) {
			if (err) {
				return callback(err);
			}
			res.render('topic', data.templateData);
		});
	});
};

topicsController.teaser = function(req, res, next) {
	var tid = req.params.topic_id;

	if (!utils.isNumber(tid)) {
		return next(new Error('[[error:invalid-tid]]'));
	}

	async.waterfall([
		function(next) {
			privileges.topics.can('read', tid, req.uid, next);
		},
		function(canRead, next) {
			if (!canRead) {
				return res.status(403).json('[[error:no-privileges]]');
			}
			topics.getLatestUndeletedPid(tid, next);
		},
		function(pid, next) {
			if (!pid) {
				return res.status(404).json('not-found');
			}
			posts.getPostSummaryByPids([pid], req.uid, {stripTags: false}, next);
		}
	], function(err, posts) {
		if (err) {
			return next(err);
		}

		if (!Array.isArray(posts) || !posts.length) {
			return res.status(404).json('not-found');
		}
		res.json(posts[0]);
	});
};

module.exports = topicsController;
