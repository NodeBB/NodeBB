var categoriesController = {},
	async = require('async'),
	qs = require('querystring'),
	categoryTools = require('../categoryTools'),
	user = require('../user'),
	categories = require('../categories'),
	topics = require('../topics');

categoriesController.recent = function(req, res, next) {
	var uid = (req.user) ? req.user.uid : 0;
	topics.getLatestTopics(uid, 0, 19, req.params.term, function (err, data) {
		if(err) {
			return next(err);
		}

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('recent', data);
		}
	});
};

categoriesController.popular = function(req, res, next) {
	var uid = (req.user) ? req.user.uid : 0;
	var set = 'topics:' + req.params.set;
	if(!req.params.set) {
		set = 'topics:posts';
	}

	topics.getTopicsFromSet(uid, set, 0, 19, function(err, data) {
		if(err) {
			return next(err);
		}

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('popular', data);
		}
	});
};

categoriesController.unread = function(req, res, next) {
	var uid = req.user.uid;
	
	topics.getUnreadTopics(uid, 0, 19, function (err, data) {
		if(err) {
			return next(err);
		}

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('unread', data);
		}
	});
};

categoriesController.unreadTotal = function(req, res, next) {
	var uid = req.user.uid;
	
	topics.getTotalUnread(uid, function (err, data) {
		if(err) {
			return next(err);
		}

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('unread', data);
		}
	});
};

categoriesController.get = function(req, res, next) {
	var cid = req.params.category_id,
		page = req.query.page || 1,
		uid = req.user ? req.user.uid : 0;

	async.waterfall([
		function(next) {
			categoryTools.privileges(cid, uid, function(err, privileges) {
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

				categories.getCategoryById(cid, start, end, 0, function (err, categoryData) {
					if (categoryData) {
						if (parseInt(categoryData.disabled, 10) === 1) {
							return next(new Error('Category disabled'), null);
						}
					}

					next(err, categoryData);
				});
			});
		},
		function (categoryData, next) {
			/*app.build_header({
				req: req,
				res: res,
				metaTags: [
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
				],
				linkTags: [
					{
						rel: 'alternate',
						type: 'application/rss+xml',
						href: nconf.get('url') + '/category/' + cid + '.rss'
					},
					{
						rel: 'up',
						href: nconf.get('url')
					}
				]
			}, function (err, header) {
				next(err, {
					header: header,
					topics: categoryData
				});
			});*/
			next(null, {
				header: null,
				topics: categoryData
			})
		}
	], function (err, data) {
		if (err) {
			if (err.message === 'not-enough-privileges') {
				return res.redirect('403');
			} else {
				return res.redirect('404');
			}
		}

		if(data.topics.link) {
			return res.redirect(data.topics.link);
		}

		var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');
		var queryString = qs.stringify(req.query);
		if(queryString.length) {
			category_url += '?' + queryString;
		}

		// Paginator for noscript
		data.topics.pages = [];
		for(var x=1;x<=data.topics.pageCount;x++) {
			data.topics.pages.push({
				page: x,
				active: x === parseInt(page, 10)
			});
		}

		res.render('category', data.topics);
		/*translator.translate(templates['noscript/category'].parse(data.topics), function(translatedHTML) {
			res.send(
				data.header +
				'\n\t<noscript>\n' + templates['noscript/header'] + translatedHTML + '\n\t</noscript>' +
				'\n\t' + app.create_route('category/' + category_url) + templates.footer
			);
		});*/
	});
};

module.exports = categoriesController;