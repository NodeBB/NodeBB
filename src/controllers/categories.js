"use strict";

var categoriesController = {},
	async = require('async'),
	qs = require('querystring'),
	nconf = require('nconf'),
	privileges = require('../privileges'),
	user = require('../user'),
	categories = require('../categories'),
	topics = require('../topics'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils');

// todo: This might be better placed somewhere else
var apiToRegular = function(url) {
	return url.replace(/^\/api/, '');
};

categoriesController.recent = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	var end = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;
	topics.getRecentTopics(uid, 0, end, function (err, data) {
		if (err) {
			return next(err);
		}

		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;

		plugins.fireHook('filter:category.get', {category: {topics: data}, uid: uid}, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('recent', data.category);
		});
	});
};

var anonCache = {}, lastUpdateTime = 0;

categoriesController.popular = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;

	var term = req.params.term || 'daily';

	if (uid === 0) {
        if (anonCache[term] && (Date.now() - lastUpdateTime) < 60 * 60 * 1000) {
            return res.render('popular', anonCache[term]);
        }
	}

	topics.getPopular(term, uid, meta.config.topicsPerList, function(err, data) {
		if (err) {
			return next(err);
		}

		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;

		plugins.fireHook('filter:category.get', {category: {topics: data}, uid: uid}, function(err, data) {
			if (err) {
				return next(err);
			}
			if (uid === 0) {
		        anonCache[term] = data.category;
		        lastUpdateTime = Date.now();
			}

			res.render('popular', data.category);
		});
	});
};

categoriesController.unread = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	var end = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;
	topics.getUnreadTopics(uid, 0, end, function (err, data) {
		if (err) {
			return next(err);
		}

		plugins.fireHook('filter:category.get', {category: {topics: data}, uid: uid}, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('unread', data.category);
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
		uid = req.user ? req.user.uid : 0,
		userPrivileges;

	if (req.params.topic_index && !utils.isNumber(req.params.topic_index)) {
		return categoriesController.notFound(req, res);
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
				return categoriesController.notFound(req, res);
			}

			if (cid + '/' + req.params.slug !== results.categoryData.slug) {
				return categoriesController.notFound(req, res);
			}

			if (!results.privileges.read) {
				return categoriesController.notAllowed(req, res);
			}

			var topicIndex = utils.isNumber(req.params.topic_index) ? parseInt(req.params.topic_index, 10) : 1;
			var topicCount = parseInt(results.categoryData.topic_count, 10) + 1;

			if (topicIndex < 1 || topicIndex > topicCount) {
				var url = '/category/' + cid + '/' + req.params.slug + (topicIndex > topicCount ? '/' + topicCount : '');
				return res.locals.isAPI ? res.status(302).json(url) : res.redirect(url);
			}

			userPrivileges = results.privileges;
			var settings = results.userSettings;

			if (!settings.usePagination) {
				topicIndex = Math.max((topicIndex || 1) - (settings.topicsPerPage - 1), 0);
			} else if (!req.query.page) {
				var index = Math.max(parseInt((topicIndex || 0), 10), 0);
				page = Math.ceil((index + 1) / settings.topicsPerPage);
			}

			var start = (page - 1) * settings.topicsPerPage + topicIndex,
				end = start + settings.topicsPerPage - 1;

			next(null, {
				cid: cid,
				start: start,
				end: end,
				uid: uid
			});
		},
		function(payload, next) {
			// If a userslug was specified, add a targetUid
			if (req.query.author) {
				user.getUidByUserslug(req.query.author, function(err, uid) {
					payload.targetUid = uid;
					next(err, payload);
				});
			} else {
				next(null, payload);
			}
		},
		categories.getCategoryById,
		function(categoryData, next) {
			categories.getRecentTopicReplies(categoryData.children, uid, function(err) {
				if (err) {
					return next(err);
				}

				next(null, categoryData);
			});
		},
		function (categoryData, next) {
			categoryData.privileges = userPrivileges;

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

		if (data.link) {
			return res.redirect(data.link);
		}

		var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');
		var queryString = qs.stringify(req.query);
		if(queryString.length) {
			category_url += '?' + queryString;
		}

		data.currentPage = page;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.csrf = req.csrfToken();

		if (!res.locals.isAPI) {
			// Paginator for noscript
			data.pages = [];
			for(var x=1;x<=data.pageCount;x++) {
				data.pages.push({
					page: x,
					active: x === parseInt(page, 10)
				});
			}
		}

		res.render('category', data);
	});
};

categoriesController.notFound = function(req, res) {
	if (res.locals.isAPI) {
		res.status(404).json('not-found');
	} else {
		res.status(404).render('404');
	}
};

categoriesController.notAllowed = function(req, res) {
	var uid = req.user ? req.user.uid : 0;

	if (uid) {
		if (res.locals.isAPI) {
			res.status(403).json('not-allowed');
		} else {
			res.status(403).render('403');
		}
	} else {
		if (res.locals.isAPI) {
			req.session.returnTo = apiToRegular(req.url);
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = req.url;
			res.redirect(nconf.get('relative_path') + '/login');
		}
	}
};

module.exports = categoriesController;
