"use strict";

var nconf = require('nconf'),
	controllers = require('./../controllers'),
	meta = require('./../meta'),
	
	plugins = require('./../plugins'),
	metaRoute = require('./meta'),
	apiRoute = require('./api'),
	admin = require('./admin'),
	feedsRoute = require('./feeds');


module.exports = function(app, middleware) {
	app.namespace(nconf.get('relative_path'), function() {
		//temp
		metaRoute.createRoutes(app);
		admin.createRoutes(app);
		feedsRoute.createRoutes(app);

		apiRoute(app, middleware, controllers);
		
		/**
		* Every view has an associated API route.
		*
		*/
		/* Main */
		app.get('/', middleware.buildHeader, controllers.home);
		app.get('/api/home', controllers.home);

		app.get('/login', middleware.buildHeader, controllers.login);
		app.get('/api/login', controllers.login);

		app.get('/register', middleware.buildHeader, controllers.register);
		app.get('/api/register', controllers.register);

		app.get('/confirm/:code', middleware.buildHeader, controllers.confirmEmail);
		app.get('/api/confirm/:code', controllers.confirmEmail);

		app.get('/outgoing', middleware.buildHeader, controllers.outgoing);
		app.get('/api/outgoing', controllers.outgoing);

		/* Static Pages */
		app.get('/404', middleware.buildHeader, controllers.static['404']);
		app.get('/api/404', controllers.static['404']);

		app.get('/403', middleware.buildHeader, controllers.static['403']);
		app.get('/api/403', controllers.static['403']);

		app.get('/500', middleware.buildHeader, controllers.static['500']);
		app.get('/api/500', controllers.static['500']);

		/* Topics */
		app.get('/topic/:topic_id/:slug?', middleware.buildHeader, controllers.topics.get);
		app.get('/api/topic/:topic_id/:slug?', controllers.topics.get);

		/* Categories */
		app.get('/popular/:set?', middleware.buildHeader, controllers.categories.popular);
		app.get('/api/popular/:set?', controllers.categories.popular);

		app.get('/recent/:term?', middleware.buildHeader, controllers.categories.recent);
		app.get('/api/recent/:term?', controllers.categories.recent);

		app.get('/unread/', middleware.buildHeader, middleware.authenticate, controllers.categories.unread);
		app.get('/api/unread/', middleware.authenticate, controllers.categories.unread);

		app.get('/unread/total', middleware.buildHeader, middleware.authenticate, controllers.categories.unreadTotal);
		app.get('/api/unread/total', middleware.authenticate, controllers.categories.unreadTotal);

		app.get('/category/:category_id/:slug?', middleware.buildHeader, controllers.categories.get);
		app.get('/api/category/:category_id/:slug?', controllers.categories.get);

		/* Accounts */
		app.get('/user/:userslug', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getAccount);
		app.get('/api/user/:userslug', middleware.checkGlobalPrivacySettings, controllers.accounts.getAccount);

		app.get('/user/:userslug/following', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowing);
		app.get('/api/user/:userslug/following', middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowing);

		app.get('/user/:userslug/followers', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowers);
		app.get('/api/user/:userslug/followers', middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowers);

		app.get('/user/:userslug/favourites', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.getFavourites);
		app.get('/api/user/:userslug/favourites', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.getFavourites);

		app.get('/user/:userslug/posts', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getPosts);
		app.get('/api/user/:userslug/posts', middleware.checkGlobalPrivacySettings, controllers.accounts.getPosts);

		app.get('/user/:userslug/edit', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);
		app.get('/api/user/:userslug/edit', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);

		// todo: admin recently gained access to this page, pls check if it actually works
		app.get('/user/:userslug/settings', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);
		app.get('/api/user/:userslug/settings', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);

		/* Users */
		app.get('/users', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users', middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		// was this duped by accident or purpose?
		app.get('/users/online', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users/online', middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		app.get('/users/sort-posts', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);
		app.get('/api/users/sort-posts', middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);

		app.get('/users/sort-reputation', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);
		app.get('/api/users/sort-reputation', middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);

		app.get('/users/latest', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);
		app.get('/api/users/latest', middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);

		app.get('/users/search', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);
		app.get('/api/users/search', middleware.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);

		/* Misc */
		app.get('/sitemap.xml', controllers.sitemap);
		app.get('/robots.txt', controllers.robots);

		//todo notifications

		app.get('api/search/:term?', function (req, res) {
			if ((req.user && req.user.uid) || meta.config.allowGuestSearching === '1') {
				return res.json({
					show_no_topics: 'hide',
					show_no_posts: 'hide',
					show_results: 'hide',
					search_query: '',
					posts: [],
					topics: []
				});
			} else {
				res.send(403);
			}
		});

		app.get('/search/:term?', function (req, res) {

			if (!req.user && meta.config.allowGuestSearching !== '1') {
				return res.redirect('/403');
			}
			if(!req.params.term) {
				req.params.term = '';
			}
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				//res.send(header + app.create_route('search/' + req.params.term, null, 'search') + templates.footer);
			});
		});


		app.get('/reset/:code', function(req, res) {
			app.build_header({
				req: req,
				res: res
			}, function(err, header) {
				res.send(header + app.create_route('reset/' + req.params.code) + templates.footer);
			});
		});

		app.get('api/reset/:code', function (req, res) {
			res.json({
				reset_code: req.params.code
			});
		});

		app.get('/reset', function(req, res) {
			app.build_header({
				req: req,
				res: res
			}, function(err, header) {
				res.send(header + app.create_route('reset') + templates.footer);
			});
		});

		app.get('api/reset', function (req, res) {
			res.json({});
		});

		
		// Other routes
		require('./plugins')(app);

		// Debug routes
		if (process.env.NODE_ENV === 'development') {
			require('./debug')(app);
		}

		var custom_routes = {
			'routes': [],
			'api': [],
			'templates': []
		};

		app.get_custom_templates = function() {
			return custom_routes.templates.map(function(tpl) {
				return tpl.template.split('.tpl')[0];
			});
		};


		plugins.ready(function() {
			/*
			* TO BE DEPRECATED post 0.4x
			*/
			plugins.fireHook('filter:server.create_routes', custom_routes, function(err, custom_routes) {
				var route,
					routes = custom_routes.routes;

				for (route in routes) {
					if (routes.hasOwnProperty(route)) {
						(function(route) {
							app[routes[route].method || 'get'](routes[route].route, function(req, res) {
								routes[route].options(req, res, function(options) {
									app.build_header({
										req: options.req || req,
										res: options.res || res
									}, function (err, header) {
										//res.send(header + options.content + templates.footer);
									});
								});
							});
						}(route));
					}
				}

				var apiRoutes = custom_routes.api;
				for (route in apiRoutes) {
					if (apiRoutes.hasOwnProperty(route)) {
						(function(route) {
							app[apiRoutes[route].method || 'get']('/api' + apiRoutes[route].route, function(req, res) {
								apiRoutes[route].callback(req, res, function(data) {
									res.json(data);
								});
							});
						}(route));
					}
				}

				var templateRoutes = custom_routes.templates;
				for (route in templateRoutes) {
					if (templateRoutes.hasOwnProperty(route)) {
						(function(route) {
							app.get('/templates/' + templateRoutes[route].template, function(req, res) {
								res.send(templateRoutes[route].content);
							});
						}(route));
					}
				}

			});
		});
	});
};