"use strict";

var topicsController = require('./topics'),
	categoriesController = require('./categories'),
	tagsController = require('./tags'),
	usersController = require('./users'),
	groupsController = require('./groups'),
	accountsController = require('./accounts'),
	staticController = require('./static'),
	apiController = require('./api'),
	adminController = require('./admin'),

	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),
	winston = require('winston'),
	auth = require('../routes/authentication'),
	meta = require('../meta'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
	search = require('../search'),
	plugins = require('../plugins'),
	categories = require('../categories'),
	privileges = require('../privileges');

var Controllers = {
	topics: topicsController,
	categories: categoriesController,
	tags: tagsController,
	users: usersController,
	groups: groupsController,
	accounts: accountsController,
	static: staticController,
	api: apiController,
	admin: adminController
};


Controllers.home = function(req, res, next) {
	async.parallel({
		header: function (next) {
			res.locals.metaTags = [{
				name: "title",
				content: meta.config.title || 'NodeBB'
			}, {
				name: "description",
				content: meta.config.description || ''
			}, {
				property: 'og:title',
				content: 'Index | ' + (meta.config.title || 'NodeBB')
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
			categories.getCategoriesByPrivilege(uid, 'find', function (err, categoryData) {
				if (err) {
					return next(err);
				}
				var childCategories = [];

				for(var i=categoryData.length - 1; i>=0; --i) {

					if (Array.isArray(categoryData[i].children) && categoryData[i].children.length) {
						childCategories.push.apply(childCategories, categoryData[i].children);
					}

					if (categoryData[i].parent && categoryData[i].parent.cid) {
						categoryData.splice(i, 1);
					}
				}

				async.parallel([
					function(next) {
						categories.getRecentTopicReplies(categoryData, uid, next);
					},
					function(next) {
						categories.getRecentTopicReplies(childCategories, uid, next);
					}
				], function(err) {
					next(err, categoryData);
				});
			});
		}
	}, function (err, data) {
		if (err) {
			return next(err);
		}
		res.render('home', data);
	});
};

Controllers.search = function(req, res, next) {
	if (!req.params.term) {
		return res.render('search', {
			time: 0,
			search_query: '',
			posts: [],
			topics: []
		});
	}

	var uid = req.user ? req.user.uid : 0;

	if (!plugins.hasListeners('filter:search.query')) {
		return res.redirect('/404');
	}

	req.params.term = validator.escape(req.params.term);

	search.search(req.params.term, uid, function(err, results) {
		if (err) {
			return next(err);
		}

		return res.render('search', results);
	});
};

Controllers.reset = function(req, res, next) {
	res.render(req.params.code ? 'reset_code' : 'reset', {
		reset_code: req.params.code ? req.params.code : null
	});
};

Controllers.login = function(req, res, next) {
	var data = {},
		login_strategies = auth.get_login_strategies(),
		num_strategies = login_strategies.length,
		emailersPresent = plugins.hasListeners('action:email.send');

	data.alternate_logins = num_strategies > 0;
	data.authentication = login_strategies;
	data.token = req.csrfToken();
	data.showResetLink = emailersPresent;
	data.allowLocalLogin = parseInt(meta.config.allowLocalLogin, 10) === 1;
	data.allowRegistration = parseInt(meta.config.allowRegistration, 10) === 1;
	data.error = req.flash('error')[0];

	res.render('login', data);
};

Controllers.register = function(req, res, next) {
	if(meta.config.allowRegistration !== undefined && parseInt(meta.config.allowRegistration, 10) === 0) {
		return res.redirect(nconf.get('relative_path') + '/403');
	}

	var data = {},
		login_strategies = auth.get_login_strategies(),
		num_strategies = login_strategies.length;

	if (num_strategies === 0) {
		data = {
			'register_window:spansize': 'col-md-12',
			'alternate_logins': false
		};
	} else {
		data = {
			'register_window:spansize': 'col-md-6',
			'alternate_logins': true
		};
	}

	data.authentication = login_strategies;

	data.token = req.csrfToken();
	data.minimumUsernameLength = meta.config.minimumUsernameLength;
	data.maximumUsernameLength = meta.config.maximumUsernameLength;
	data.minimumPasswordLength = meta.config.minimumPasswordLength;
	data.termsOfUse = meta.config.termsOfUse;
	data.regFormEntry = [];

	plugins.fireHook('filter:register.build', req, res, data, function(err, req, res, data) {
		if (err && process.env === 'development') {
			winston.warn(JSON.stringify(err));
		}
		res.render('register', data);
	});
};


Controllers.confirmEmail = function(req, res, next) {
	user.email.confirm(req.params.code, function (data) {
		data.status = data.status === 'ok';
		res.render('confirm', data);
	});
};

Controllers.sitemap = function(req, res, next) {
	if (meta.config['feeds:disableSitemap'] === '1') {
		return res.redirect(nconf.get('relative_path') + '/404');
	}

	var sitemap = require('../sitemap.js');

	sitemap.render(function(xml) {
		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

Controllers.robots = function (req, res) {
	res.set('Content-Type', 'text/plain');

	if (meta.config["robots.txt"]) {
		res.send(meta.config["robots.txt"]);
	} else {
		res.send("User-agent: *\n" +
			"Disallow: " + nconf.get('relative_path') + "/admin/\n" +
			"Sitemap: " + nconf.get('url') + "/sitemap.xml");
	}
};

Controllers.outgoing = function(req, res, next) {
	var url = req.query.url,
		data = {
			url: url,
			title: meta.config.title
		};

	if (url) {
		res.render('outgoing', data);
	} else {
		res.status(404);
		res.redirect(nconf.get('relative_path') + '/404');
	}
};

module.exports = Controllers;
