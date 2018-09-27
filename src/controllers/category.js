'use strict';


var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var privileges = require('../privileges');
var user = require('../user');
var categories = require('../categories');
var meta = require('../meta');
var pagination = require('../pagination');
var helpers = require('./helpers');
var utils = require('../utils');
var translator = require('../translator');
var analytics = require('../analytics');

var categoryController = module.exports;

categoryController.get = function (req, res, callback) {
	var cid = req.params.category_id;
	var currentPage = parseInt(req.query.page, 10) || 1;
	var pageCount = 1;
	var userPrivileges;
	var settings;
	var rssToken;

	if ((req.params.topic_index && !utils.isNumber(req.params.topic_index)) || !utils.isNumber(cid)) {
		return callback();
	}

	var topicIndex = utils.isNumber(req.params.topic_index) ? parseInt(req.params.topic_index, 10) - 1 : 0;

	async.waterfall([
		function (next) {
			async.parallel({
				categoryData: function (next) {
					categories.getCategoryFields(cid, ['slug', 'disabled', 'topic_count'], next);
				},
				privileges: function (next) {
					privileges.categories.get(cid, req.uid, next);
				},
				userSettings: function (next) {
					user.getSettings(req.uid, next);
				},
				rssToken: function (next) {
					user.auth.getFeedToken(req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			userPrivileges = results.privileges;
			rssToken = results.rssToken;

			if (!results.categoryData.slug || (results.categoryData && parseInt(results.categoryData.disabled, 10) === 1)) {
				return callback();
			}

			if (!results.privileges.read) {
				return helpers.notAllowed(req, res);
			}

			if (!res.locals.isAPI && (!req.params.slug || results.categoryData.slug !== cid + '/' + req.params.slug) && (results.categoryData.slug && results.categoryData.slug !== cid + '/')) {
				return helpers.redirect(res, '/category/' + results.categoryData.slug);
			}

			settings = results.userSettings;

			var topicCount = parseInt(results.categoryData.topic_count, 10);
			pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));

			if (topicIndex < 0 || topicIndex > Math.max(topicCount - 1, 0)) {
				return helpers.redirect(res, '/category/' + cid + '/' + req.params.slug + (topicIndex > topicCount ? '/' + topicCount : ''));
			}

			if (settings.usePagination && (currentPage < 1 || currentPage > pageCount)) {
				return callback();
			}

			if (!settings.usePagination) {
				topicIndex = Math.max(0, topicIndex - (Math.ceil(settings.topicsPerPage / 2) - 1));
			} else if (!req.query.page) {
				var index = Math.max(parseInt((topicIndex || 0), 10), 0);
				currentPage = Math.ceil((index + 1) / settings.topicsPerPage);
				topicIndex = 0;
			}

			user.getUidByUserslug(req.query.author, next);
		},
		function (targetUid, next) {
			var start = ((currentPage - 1) * settings.topicsPerPage) + topicIndex;
			var stop = start + settings.topicsPerPage - 1;
			categories.getCategoryById({
				uid: req.uid,
				cid: cid,
				start: start,
				stop: stop,
				sort: req.query.sort || settings.categoryTopicSort,
				settings: settings,
				query: req.query,
				tag: req.query.tag,
				targetUid: targetUid,
			}, next);
		},
		function (categoryData, next) {
			categories.modifyTopicsByPrivilege(categoryData.topics, userPrivileges);

			if (categoryData.link) {
				db.incrObjectField('category:' + categoryData.cid, 'timesClicked');
				return helpers.redirect(res, categoryData.link);
			}

			buildBreadcrumbs(req, categoryData, next);
		},
		function (categoryData, next) {
			if (!categoryData.children.length) {
				return next(null, categoryData);
			}

			var allCategories = [];
			categories.flattenCategories(allCategories, categoryData.children);
			categories.getRecentTopicReplies(allCategories, req.uid, function (err) {
				next(err, categoryData);
			});
		},
		function (categoryData) {
			categoryData.description = translator.escape(categoryData.description);
			categoryData.privileges = userPrivileges;
			categoryData.showSelect = categoryData.privileges.editable;
			categoryData.rssFeedUrl = nconf.get('url') + '/category/' + categoryData.cid + '.rss';
			if (parseInt(req.uid, 10)) {
				categories.markAsRead([cid], req.uid);
				categoryData.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
			}

			addTags(categoryData, res);

			categoryData['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
			categoryData['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;
			categoryData.title = translator.escape(categoryData.name);
			pageCount = Math.max(1, Math.ceil(categoryData.topic_count / settings.topicsPerPage));
			categoryData.pagination = pagination.create(currentPage, pageCount, req.query);
			categoryData.pagination.rel.forEach(function (rel) {
				rel.href = nconf.get('url') + '/category/' + categoryData.slug + rel.href;
				res.locals.linkTags.push(rel);
			});

			analytics.increment(['pageviews:byCid:' + categoryData.cid]);

			res.render('category', categoryData);
		},
	], callback);
};

function buildBreadcrumbs(req, categoryData, callback) {
	var breadcrumbs = [
		{
			text: categoryData.name,
			url: nconf.get('relative_path') + '/category/' + categoryData.slug,
		},
	];
	async.waterfall([
		function (next) {
			helpers.buildCategoryBreadcrumbs(categoryData.parentCid, next);
		},
		function (crumbs, next) {
			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/category') || req.originalUrl.startsWith(nconf.get('relative_path') + '/category')) {
				categoryData.breadcrumbs = crumbs.concat(breadcrumbs);
			}
			next(null, categoryData);
		},
	], callback);
}

function addTags(categoryData, res) {
	res.locals.metaTags = [
		{
			name: 'title',
			content: categoryData.name,
		},
		{
			property: 'og:title',
			content: categoryData.name,
		},
		{
			name: 'description',
			content: categoryData.description,
		},
		{
			property: 'og:type',
			content: 'website',
		},
	];

	if (categoryData.backgroundImage) {
		if (!categoryData.backgroundImage.startsWith('http')) {
			categoryData.backgroundImage = nconf.get('url') + categoryData.backgroundImage;
		}
		res.locals.metaTags.push({
			property: 'og:image',
			content: categoryData.backgroundImage,
		});
	}

	res.locals.linkTags = [
		{
			rel: 'up',
			href: nconf.get('url'),
		},
	];

	if (!categoryData['feeds:disableRSS']) {
		res.locals.linkTags.push({
			rel: 'alternate',
			type: 'application/rss+xml',
			href: categoryData.rssFeedUrl,
		});
	}
}
