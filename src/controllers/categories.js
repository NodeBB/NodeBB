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
	winston = require('winston'),
	util = require('util');

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

		plugins.fireHook('filter:category.get', data, uid, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('recent', data);
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

		plugins.fireHook('filter:category.get', {topics: data}, uid, function(err, data) {
			if (err) {
				return next(err);
			}
			if (uid === 0) {
		        anonCache[term] = data;
		        lastUpdateTime = Date.now();
			}

			res.render('popular', data);
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

		plugins.fireHook('filter:category.get', data, uid, function(err, data) {
			if (err) {
				return next(err);
			}
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
			async.parallel({
				exists: function(next) {
					categories.exists(cid, next);
				},
				categoryData: function(next) {
					categories.getCategoryFields(cid, ['slug', 'disabled'], next);
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

			var settings = results.userSettings;

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

				categories.getRecentTopicReplies(categoryData.children, uid, function(err) {
					if (err) {
						return next(err);
					}
					categoryData.privileges = results.privileges;
					categoryData.topicsPerPage = settings.topicsPerPage || 20;
					next(null, categoryData);
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
		
		/* 
		 * Pagination logic
		 */
		 var itemsPerPage = data.topicsPerPage || 20;
		 var pageCount    = Math.ceil(data.topic_count / itemsPerPage);
		 // generic pagination logic 
		 var show_p  = Math.min(pageCount, 10); /* don't render more than 10 page links at once, paginate */
		 var curr_p  = parseInt(page, 10);  // 1-based
		 var start_p = 1 + Math.floor((curr_p - 1) / show_p) * show_p;
		 var last_p  = Math.min(start_p + show_p, pageCount+1); // last page is just beyong current chapter
		 
		 winston.info("[pag.cat]: ", curr_p,"/", pageCount, " shown=", show_p," [",start_p, ":", last_p,"]");

		data.paginate= {
		 	prev: { // prev chapter link
				 	page: Math.max(1, start_p-1),
				 	active: start_p > 1
				},
			next: { // next chapter link
				 	page:   last_p,
				 	active: last_p <= pageCount
				},
		 };

	
		data.pages = [];
		for(var x=start_p; x < last_p; x++) {
			data.pages.push({
				page:   x,
				active: x == curr_p
			});
		}
		/* pagination rel tags  <link rel={prev|next} /> */
		if(curr_p < pageCount){
			res.locals.linkTags.push({
				rel: 'next',
				href: util.format('?page=%s', curr_p+1)
			});
		}
		if(curr_p > 1){
			res.locals.linkTags.push({
				rel: 'prev',
				href: util.format('?page=%s', curr_p-1)
			});
		}
		winston.info("[pag.cat] pages=%j", data.pages);
		winston.info("[pag.cat]", "%j", data.paginate);
		/* end pagination */
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
