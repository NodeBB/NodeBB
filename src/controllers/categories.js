"use strict";

var categoriesController = {},
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),

	db = require('../database'),
	privileges = require('../privileges'),
	user = require('../user'),
	categories = require('../categories'),
	topics = require('../topics'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	pagination = require('../pagination'),
	helpers = require('./helpers'),
	utils = require('../../public/src/utils');

categoriesController.recent = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	var end = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;
	topics.getTopicsFromSet('topics:recent', uid, 0, end, function(err, data) {
		if (err) {
			return next(err);
		}

		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
		data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);
		res.render('recent', data);
	});
};

var anonCache = {}, lastUpdateTime = 0;

categoriesController.popular = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	var terms = {
		daily: 'day',
		weekly: 'week',
		monthly: 'month',
		alltime: 'alltime'
	};
	var term = terms[req.params.term] || 'day';

	if (uid === 0) {
		if (anonCache[term] && (Date.now() - lastUpdateTime) < 60 * 60 * 1000) {
			return res.render('popular', anonCache[term]);
		}
	}

	topics.getPopular(term, uid, meta.config.topicsPerList, function(err, topics) {
		if (err) {
			return next(err);
		}

		var data = {
			topics: topics,
			'feeds:disableRSS': parseInt(meta.config['feeds:disableRSS'], 10) === 1,
			rssFeedUrl: nconf.get('relative_path') + '/popular/' + (req.params.term || 'daily') + '.rss',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[global:header.popular]]'}])
		};

		if (uid === 0) {
			anonCache[term] = data;
			lastUpdateTime = Date.now();
		}

		res.render('popular', data);
	});
};

categoriesController.unread = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	var end = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;
	topics.getUnreadTopics(uid, 0, end, function (err, data) {
		if (err) {
			return next(err);
		}

		data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[unread:title]]'}]);
		res.render('unread', data);
	});
};

categoriesController.unreadTotal = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;

	topics.getTotalUnread(uid, function (err, data) {
		if(err) {
			return next(err);
		}

		res.json(data);
	});
};

categoriesController.list = function(req, res, next) {
	async.parallel({
		header: function (next) {
			res.locals.metaTags = [{
				name: "title",
				content: validator.escape(meta.config.title || 'NodeBB')
			}, {
				name: "description",
				content: validator.escape(meta.config.description || '')
			}, {
				property: 'og:title',
				content: 'Index | ' + validator.escape(meta.config.title || 'NodeBB')
			}, {
				property: 'og:type',
				content: 'website'
			}];

			if(meta.config['brand:logo']) {
				res.locals.metaTags.push({
					property: 'og:image',
					content: meta.config['brand:logo']
				});
			}

			next(null);
		},
		categories: function (next) {
			var uid = req.user ? req.user.uid : 0;
			var categoryData;
			async.waterfall([
				function(next) {
					categories.getCategoriesByPrivilege(uid, 'find', next);
				},
				function(_categoryData, next) {
					categoryData = _categoryData;
					var allCategories = [];

					categoryData = categoryData.filter(function(category) {
						if (!category.parent) {
							allCategories.push(category);
						}

						if (Array.isArray(category.children) && category.children.length) {
							allCategories.push.apply(allCategories, category.children);
						}
						return category && !category.parent;
					});

					categories.getRecentTopicReplies(allCategories, uid, next);
				}
			], function(err) {
				next(err, categoryData);
			});
		}
	}, function (err, data) {
		if (err) {
			return next(err);
		}

		plugins.fireHook('filter:categories.build', {req: req, res: res, templateData: data}, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('categories', data.templateData);
		});
	});
};

categoriesController.get = function(req, res, next) {
	var cid = req.params.category_id,
		page = req.query.page || 1,
		uid = req.user ? req.user.uid : 0,
		userPrivileges;

	if (req.params.topic_index && !utils.isNumber(req.params.topic_index)) {
		return helpers.notFound(req, res);
	}

	async.waterfall([
		function(next) {
			async.parallel({
				exists: function(next) {
					categories.exists(cid, next);
				},
				categoryData: function(next) {
					categories.getCategoryFields(cid, ['slug', 'disabled', 'topic_count'], next);
				},
				privileges: function(next) {
					privileges.categories.get(cid, uid, next);
				},
				userSettings: function(next) {
					user.getSettings(uid, next);
				}
			}, next);
		},
		function(results, next) {
			if (!results.exists || (results.categoryData && parseInt(results.categoryData.disabled, 10) === 1)) {
				return helpers.notFound(req, res);
			}

			if (cid + '/' + req.params.slug !== results.categoryData.slug) {
				return helpers.notFound(req, res);
			}

			if (!results.privileges.read) {
				return helpers.notAllowed(req, res);
			}

			var topicIndex = utils.isNumber(req.params.topic_index) ? parseInt(req.params.topic_index, 10) - 1 : 0;
			var topicCount = parseInt(results.categoryData.topic_count, 10);

			if (topicIndex < 0 || topicIndex > Math.max(topicCount - 1, 0)) {
				return helpers.redirect(res, '/category/' + cid + '/' + req.params.slug + (topicIndex > topicCount ? '/' + topicCount : ''));
			}

			userPrivileges = results.privileges;
			var settings = results.userSettings;

			if (!settings.usePagination) {
				topicIndex = Math.max(topicIndex - (settings.topicsPerPage - 1), 0);
			} else if (!req.query.page) {
				var index = Math.max(parseInt((topicIndex || 0), 10), 0);
				page = Math.ceil((index + 1) / settings.topicsPerPage);
				topicIndex = 0;
			}

			var set = 'cid:' + cid + ':tids',
				reverse = false;

			if (settings.categoryTopicSort === 'newest_to_oldest') {
				reverse = true;
			} else if (settings.categoryTopicSort === 'most_posts') {
				reverse = true;
				set = 'cid:' + cid + ':tids:posts';
			}

			var start = (page - 1) * settings.topicsPerPage + topicIndex,
				stop = start + settings.topicsPerPage - 1;

			next(null, {
				cid: cid,
				set: set,
				reverse: reverse,
				start: start,
				stop: stop,
				uid: uid
			});
		},
		function(payload, next) {
			user.getUidByUserslug(req.query.author, function(err, uid) {
				payload.targetUid = uid;
				if (uid) {
					payload.set = 'cid:' + cid + ':uid:' + uid + ':tids';
				}
				next(err, payload);
			});
		},
		function(payload, next) {
			categories.getCategoryById(payload, next);
		},
		function(categoryData, next) {
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
		function(categoryData, next) {
			categories.getRecentTopicReplies(categoryData.children, uid, function(err) {
				next(err, categoryData);
			});
		},
		function (categoryData, next) {
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

			if(categoryData.backgroundImage) {
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

			next(null, categoryData);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.currentPage = page;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/category/' + data.cid + '.rss';
		data.pagination = pagination.create(data.currentPage, data.pageCount);

		data.pagination.rel.forEach(function(rel) {
			res.locals.linkTags.push(rel);
		});

		plugins.fireHook('filter:category.build', {req: req, res: res, templateData: data}, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('category', data.templateData);
		});
	});
};



module.exports = categoriesController;
