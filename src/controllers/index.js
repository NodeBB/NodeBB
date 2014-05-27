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
	auth = require('../routes/authentication'),
	meta = require('../meta'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
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
			categories.getVisibleCategories(uid, function (err, categoryData) {
				if (err) {
					return next(err);
				}

				function getRecentReplies(category, callback) {
					categories.getRecentReplies(category.cid, uid, parseInt(category.numRecentReplies, 10), function (err, posts) {
						if (err) {
							return callback(err);
						}
						category.posts = posts;
						callback();
					});
				}

				async.each(categoryData, getRecentReplies, function (err) {
					next(err, categoryData);
				});
			});
		}
	}, function (err, data) {
		res.render('home', data);
	});
};

Controllers.search = function(req, res, next) {
	var start = process.hrtime();

	if (!req.params.term) {
		return res.render('search', {
			search_query: '',
			posts: [],
			topics: []
		});
	}

	if (!plugins.hasListeners('filter:search.query')) {
		return res.redirect('/404');
	}

	function search(index, callback) {
		plugins.fireHook('filter:search.query', {
			index: index,
			query: req.params.term
		}, callback);
	}

	async.parallel({
		pids: function(next) {
			search('post', next);
		},
		tids: function(next) {
			search('topic', next);
		}
	}, function (err, results) {
		if (err) {
			return next(err);
		}

		if(!results) {
			results = {pids:[], tids: []};
		}

		async.parallel({
			posts: function(next) {
				posts.getPostSummaryByPids(results.pids, false, next);
			},
			topics: function(next) {
				topics.getTopicsByTids(results.tids, 0, next);
			}
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			return res.render('search', {
				time: process.elapsedTimeSince(start),
				search_query: req.params.term,
				posts: results.posts,
				topics: results.topics,
				post_matches : results.posts.length,
				topic_matches : results.topics.length
			});
		});
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
	data.token = res.locals.csrf_token;
	data.showResetLink = emailersPresent;
	data.allowLocalLogin = meta.config.allowLocalLogin === undefined || parseInt(meta.config.allowLocalLogin, 10) === 1;
	if (req.query.next) {
		data.previousUrl = req.query.next;
	}

	res.render('login', data);
};

Controllers.register = function(req, res, next) {

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

	data.token = res.locals.csrf_token;
	data.minimumUsernameLength = meta.config.minimumUsernameLength;
	data.maximumUsernameLength = meta.config.maximumUsernameLength;
	data.minimumPasswordLength = meta.config.minimumPasswordLength;
	data.termsOfUse = meta.config.termsOfUse;

	plugins.fireHook('filter:register.build', req, res, data, function(err, req, res, data) {
		if (err && process.env === 'development') {
			winston.warn(JSON.stringify(err));
		}
		res.render('register', data);
	});
};


Controllers.confirmEmail = function(req, res, next) {
	user.email.confirm(req.params.code, function (data) {
		if (data.status === 'ok') {
			data = {
				'alert-class': 'alert-success',
				title: 'Email Confirmed',
				text: 'Thank you for vaidating your email. Your account is now fully activated.'
			};
		} else {
			data = {
				'alert-class': 'alert-danger',
				title: 'An error occurred...',
				text: 'There was a problem validating your email address. Perhaps the code was invalid or has expired.'
			};
		}

		res.render('confirm', data);
	});
};

Controllers.sitemap = function(req, res, next) {
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
