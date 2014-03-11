"use strict";

var topicsController = require('./topics'),
	categoriesController = require('./categories'),
	usersController = require('./users'),
	accountsController = require('./accounts'),
	staticController = require('./static'),
	apiController = require('./api'),
	adminController = require('./admin'),

	async = require('async'),
	nconf = require('nconf'),
	auth = require('./../routes/authentication'),
	meta = require('./../meta'),
	user = require('./../user'),
	posts = require('./../posts'),
	topics = require('./../topics'),
	plugins = require('./../plugins'),
	categories = require('./../categories'),
	categoryTools = require('./../categoryTools');



var Controllers = {
	topics: topicsController,
	categories: categoriesController,
	users: usersController,
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
				property: "og:type",
				content: 'website'
			}];

			next(null);
		},
		categories: function (next) {
			var uid = (req.user) ? req.user.uid : 0;
			categories.getAllCategories(uid, function (err, data) {
				data.categories = data.categories.filter(function (category) {
					return !category.disabled;
				});

				function canSee(category, next) {
					categoryTools.privileges(category.cid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
						next(!err && privileges.read);
					});
				}

				function getRecentReplies(category, callback) {
					categories.getRecentReplies(category.cid, uid, parseInt(category.numRecentReplies, 10), function (err, posts) {
						category.posts = posts;
						category.post_count = posts.length > 2 ? 2 : posts.length; // this was a hack to make metro work back in the day, post_count should just = length
						callback(null);
					});
				}

				async.filter(data.categories, canSee, function(visibleCategories) {
					data.categories = visibleCategories;

					async.each(data.categories, getRecentReplies, function (err) {
						next(err, data.categories);
					});
				});
			});
		}
	}, function (err, data) {
		res.render('home', data);
	});
};

Controllers.search = function(req, res, next) {
	if (!req.params.term) {
		return res.render('search', {
			show_no_topics: 'hide',
			show_no_posts: 'hide',
			show_results: 'hide',
			search_query: '',
			posts: [],
			topics: []
		});
	}

	if (!plugins.hasListeners('filter:search.query')) {
		return res.redirect('/404');
	}

	function searchPosts(callback) {
		plugins.fireHook('filter:search.query', {
			index: 'post',
			query: req.params.term
		}, function(err, pids) {
			if (err) {
				return callback(err);
			}

			posts.getPostSummaryByPids(pids, false, callback);
		});
	}

	function searchTopics(callback) {
		plugins.fireHook('filter:search.query', {
			index: 'topic',
			query: req.params.term
		}, function(err, tids) {
			if (err) {
				return callback(err);
			}

			topics.getTopicsByTids(tids, 0, callback);
		});
	}

	async.parallel([searchPosts, searchTopics], function (err, results) {
		if (err) {
			return next(err);
		}

		if(!results) {
			results = [];
			results[0] = results[1] = [];
		}

		return res.render('search', {
			show_no_topics: results[1].length ? 'hide' : '',
			show_no_posts: results[0].length ? 'hide' : '',
			show_results: '',
			search_query: req.params.term,
			posts: results[0],
			topics: results[1],
			post_matches : results[0].length,
			topic_matches : results[1].length
		});
	});
};

Controllers.reset = function(req, res, next) {
	res.render('reset', {
		reset_code: req.params.code ? req.params.code : null
	});
};

Controllers.login = function(req, res, next) {
	var data = {},
		login_strategies = auth.get_login_strategies(),
		num_strategies = login_strategies.length,
		emailersPresent = plugins.hasListeners('action:email.send');

	if (num_strategies === 0) {
		data = {
			'login_window:spansize': 'col-md-12',
			'alternate_logins': false
		};
	} else {
		data = {
			'login_window:spansize': 'col-md-6',
			'alternate_logins': true
		};
	}

	data.authentication = login_strategies;
	data.token = res.locals.csrf_token;
	data.showResetLink = emailersPresent;

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

	res.render('register', data);
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
	var sitemap = require('./../sitemap.js');

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