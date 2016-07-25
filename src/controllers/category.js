"use strict";


var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var privileges = require('../privileges');
var user = require('../user');
var categories = require('../categories');
var meta = require('../meta');
var pagination = require('../pagination');
var helpers = require('./helpers');
var utils = require('../../public/src/utils');

var categoryController = {};

categoryController.get = function(req, res, callback) {
	var cid = req.params.category_id;
	var currentPage = parseInt(req.query.page, 10) || 1;
	var pageCount = 1;
	var userPrivileges;

	if ((req.params.topic_index && !utils.isNumber(req.params.topic_index)) || !utils.isNumber(cid)) {
		return callback();
	}

	async.waterfall([
		function (next) {
			async.parallel({
				categoryData: function(next) {
					categories.getCategoryFields(cid, ['slug', 'disabled', 'topic_count'], next);
				},
				privileges: function(next) {
					privileges.categories.get(cid, req.uid, next);
				},
				userSettings: function(next) {
					user.getSettings(req.uid, next);
				}
			}, next);
		},
		function (results, next) {
			userPrivileges = results.privileges;

			if (!results.categoryData.slug || (results.categoryData && parseInt(results.categoryData.disabled, 10) === 1)) {
				return callback();
			}

			if (!results.privileges.read) {
				return helpers.notAllowed(req, res);
			}

			if (!res.locals.isAPI && (!req.params.slug || results.categoryData.slug !== cid + '/' + req.params.slug) && (results.categoryData.slug && results.categoryData.slug !== cid + '/')) {
				return helpers.redirect(res, '/category/' + results.categoryData.slug);
			}

			var settings = results.userSettings;
			var topicIndex = utils.isNumber(req.params.topic_index) ? parseInt(req.params.topic_index, 10) - 1 : 0;
			var topicCount = parseInt(results.categoryData.topic_count, 10);
			pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));

			if (topicIndex < 0 || topicIndex > Math.max(topicCount - 1, 0)) {
				return helpers.redirect(res, '/category/' + cid + '/' + req.params.slug + (topicIndex > topicCount ? '/' + topicCount : ''));
			}

			if (settings.usePagination && (currentPage < 1 || currentPage > pageCount)) {
				return callback();
			}

			if (!settings.usePagination) {
				topicIndex = Math.max(topicIndex - (settings.topicsPerPage - 1), 0);
			} else if (!req.query.page) {
				var index = Math.max(parseInt((topicIndex || 0), 10), 0);
				currentPage = Math.ceil((index + 1) / settings.topicsPerPage);
				topicIndex = 0;
			}

			var set = 'cid:' + cid + ':tids';
			var reverse = false;
			// `sort` qs has priority over user setting
			var sort = req.query.sort || settings.categoryTopicSort;
			if (sort === 'newest_to_oldest') {
				reverse = true;
			} else if (sort === 'most_posts') {
				reverse = true;
				set = 'cid:' + cid + ':tids:posts';
			}

			var start = (currentPage - 1) * settings.topicsPerPage + topicIndex;
			var stop = start + settings.topicsPerPage - 1;

			next(null, {
				cid: cid,
				set: set,
				reverse: reverse,
				start: start,
				stop: stop,
				uid: req.uid,
				settings: settings
			});
		},
		function (payload, next) {
			user.getUidByUserslug(req.query.author, function(err, uid) {
				payload.targetUid = uid;
				if (uid) {
					payload.set = 'cid:' + cid + ':uid:' + uid + ':tids';
				}
				next(err, payload);
			});
		},
		function (payload, next) {
			categories.getCategoryById(payload, next);
		},
		function (categoryData, next) {

			categories.modifyTopicsByPrivilege(categoryData.topics, userPrivileges);

			if (categoryData.link) {
				db.incrObjectField('category:' + categoryData.cid, 'timesClicked');
				return res.redirect(categoryData.link);
			}

			var breadcrumbs = [
				{
					text: categoryData.name,
					url: nconf.get('relative_path') + '/category/' + categoryData.slug
				}
			];
			helpers.buildCategoryBreadcrumbs(categoryData.parentCid, function(err, crumbs) {
				if (err) {
					return next(err);
				}
				categoryData.breadcrumbs = crumbs.concat(breadcrumbs);
				next(null, categoryData);
			});
		},
		function (categoryData, next) {
			if (!categoryData.children.length) {
				return next(null, categoryData);
			}
			var allCategories = [];
			categories.flattenCategories(allCategories, categoryData.children);
			categories.getRecentTopicReplies(allCategories, req.uid, function(err) {
				next(err, categoryData);
			});
		}
	], function (err, categoryData) {
		if (err) {
			return callback(err);
		}

		categoryData.privileges = userPrivileges;
		categoryData.showSelect = categoryData.privileges.editable;

		res.locals.metaTags = [
			{
				name: 'title',
				content: categoryData.name
			},
			{
				property: 'og:title',
				content: categoryData.name
			},
			{
				name: 'description',
				content: categoryData.description
			},
			{
				property: "og:type",
				content: 'website'
			}
		];

		if (categoryData.backgroundImage) {
			res.locals.metaTags.push({
				name: 'og:image',
				content: categoryData.backgroundImage
			});
		}

		res.locals.linkTags = [
			{
				rel: 'alternate',
				type: 'application/rss+xml',
				href: nconf.get('url') + '/category/' + cid + '.rss'
			},
			{
				rel: 'up',
				href: nconf.get('url')
			}
		];

		categoryData['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		categoryData.rssFeedUrl = nconf.get('relative_path') + '/category/' + categoryData.cid + '.rss';
		categoryData.title = categoryData.name;
		categoryData.pagination = pagination.create(currentPage, pageCount, req.query);
		categoryData.pagination.rel.forEach(function(rel) {
			rel.href = nconf.get('url') + '/category/' + categoryData.slug + rel.href;
			res.locals.linkTags.push(rel);
		});

		res.render('category', categoryData);
	});
};


module.exports = categoryController;
