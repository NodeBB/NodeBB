"use strict";

var categoriesController = {},
	async = require('async'),
	qs = require('querystring'),
	nconf = require('nconf'),
	privileges = require('../privileges'),
	user = require('./../user'),
	categories = require('./../categories'),
	topics = require('./../topics'),
	meta = require('./../meta'),
	plugins = require('./../plugins');

categoriesController.recent = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	topics.getLatestTopics(uid, 0, 19, req.params.term, function (err, data) {
		if(err) {
			return next(err);
		}

		data['feeds:disableRSS'] = meta.config['feeds:disableRSS'] === '1' ? true : false;

		plugins.fireHook('filter:category.get', data, uid, function(err, data) {
			res.render('recent', data);
		});
	});
};

categoriesController.popular = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;

	var term = req.params.term || 'daily';

	topics.getPopular(term, uid, function(err, data) {
		if(err) {
			return next(err);
		}

		data['feeds:disableRSS'] = meta.config['feeds:disableRSS'] === '1' ? true : false;

		plugins.fireHook('filter:category.get', {topics: data}, uid, function(err, data) {
			res.render('popular', data);
		});
	});
};

categoriesController.unread = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;

	topics.getUnreadTopics(uid, 0, 20, function (err, data) {
		if(err) {
			return next(err);
		}

		plugins.fireHook('filter:category.get', data, uid, function(err, data) {
			res.render('unread', data);
		});
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

categoriesController.get = function(req, res, next) {
	var cid = req.params.category_id,
		page = req.query.page || 1,
		uid = req.user ? req.user.uid : 0;

	async.waterfall([
		function(next) {
			categories.getCategoryField(cid, 'disabled', next);
		},
		function(disabled, next) {
			if (parseInt(disabled, 10) === 1) {
				return next(new Error('[[error:category-disabled]]'));
			}

			privileges.categories.get(cid, uid, next);
		},
		function (privileges, next) {
			if (!privileges.read) {
				return next(new Error('[[error:no-privileges]]'));
			}

			user.getSettings(uid, function(err, settings) {
				if (err) {
					return next(err);
				}

				var topicIndex = 0;
				if (!settings.usePagination) {
					topicIndex = Math.max((req.params.topic_index || 1) - (settings.topicsPerPage - 1), 0);
				} else if (!req.query.page) {
					var index = Math.max(parseInt((req.params.topic_index || 0), 10), 0);
					page = Math.ceil((index + 1) / settings.topicsPerPage);
				}

				var start = (page - 1) * settings.topicsPerPage + topicIndex,
					end = start + settings.topicsPerPage - 1;

				categories.getCategoryById(cid, start, end, uid, function (err, categoryData) {
					if (err) {
						return next(err);
					}

					categoryData.privileges = privileges;
					next(err, categoryData);
				});
			});
		},
		function (categoryData, next) {
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
			return res.locals.isAPI ? res.json(404, 'not-found') : res.redirect(nconf.get('relative_path') + '/404');
		}

		if (data.link) {
			return res.redirect(data.link);
		}

		var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');
		var queryString = qs.stringify(req.query);
		if(queryString.length) {
			category_url += '?' + queryString;
		}

		data.currentPage = page;
		data['feeds:disableRSS'] = meta.config['feeds:disableRSS'] === '1' ? true : false;

		// Paginator for noscript
		data.pages = [];
		for(var x=1;x<=data.pageCount;x++) {
			data.pages.push({
				page: x,
				active: x === parseInt(page, 10)
			});
		}
		res.render('category', data);
	});
};

module.exports = categoriesController;
