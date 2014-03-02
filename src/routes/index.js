"use strict";

var nconf = require('nconf'),
	controllers = require('./../controllers'),
	meta = require('./../meta'),
	middleware = {},
	
	/*temp*/
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
		apiRoute.createRoutes(app);
		feedsRoute.createRoutes(app);

		// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
		/*(function () {
			var routes = [],
				loginRequired = ['notifications'];

			async.each(routes.concat(loginRequired), function(route, next) {
				app.get('/' + route, function (req, res) {
					if (loginRequired.indexOf(route) !== -1 && !req.user) {
						return res.redirect('/403');
					}

					app.build_header({
						req: req,
						res: res
					}, function (err, header) {
						res.send((isNaN(parseInt(route, 10)) ? 200 : parseInt(route, 10)), header + app.create_route(route) + templates.footer);
					});
				});
			});
		}());*/

		/* Main */
		app.get('/', middleware.buildHeader, controllers.home);
		app.get('/api/home', middleware.prepareAPI, controllers.home);

		app.get('/login', middleware.buildHeader, controllers.login);
		app.get('/api/login', middleware.prepareAPI, controllers.login);

		app.get('/register', middleware.buildHeader, controllers.register);
		app.get('/api/register', middleware.prepareAPI, controllers.register);

		app.get('/confirm/:code', middleware.buildHeader, controllers.confirmEmail);
		app.get('/api/confirm/:code', middleware.prepareAPI, controllers.confirmEmail);

		app.get('/sitemap.xml', controllers.sitemap);
		app.get('/robots.txt', controllers.robots);

		app.get('/outgoing', middleware.buildHeader, controllers.outgoing);
		app.get('/api/outgoing', middleware.prepareAPI, controllers.outgoing);

		/* Static Pages */
		app.get('/404', middleware.buildHeader, controllers.static['404']);
		app.get('/api/404', middleware.prepareAPI, controllers.static['404']);

		app.get('/403', middleware.buildHeader, controllers.static['403']);
		app.get('/api/403', middleware.prepareAPI, controllers.static['403']);

		app.get('/500', middleware.buildHeader, controllers.static['500']);
		app.get('/api/500', middleware.prepareAPI, controllers.static['500']);

		/* Topics */
		app.get('/topic/:topic_id/:slug?', middleware.buildHeader, controllers.topics.get);
		app.get('/api/topic/:topic_id/:slug?', middleware.prepareAPI, controllers.topics.get);

		/* Categories */
		app.get('/popular/:set?', middleware.buildHeader, controllers.categories.popular);
		app.get('/api/popular/:set?', middleware.prepareAPI, controllers.categories.popular);

		app.get('/recent/:term?', middleware.buildHeader, controllers.categories.recent);
		app.get('/api/recent/:term?', middleware.prepareAPI, controllers.categories.recent);

		app.get('/unread/', middleware.buildHeader, middleware.authenticate, controllers.categories.unread);
		app.get('/api/unread/', middleware.prepareAPI, middleware.authenticate, controllers.categories.unread);

		app.get('/unread/total', middleware.buildHeader, middleware.authenticate, controllers.categories.unreadTotal);
		app.get('/api/unread/total', middleware.prepareAPI, middleware.authenticate, controllers.categories.unreadTotal);

		app.get('/category/:category_id/:slug?', middleware.buildHeader, controllers.categories.get);
		app.get('/api/category/:category_id/:slug?', middleware.prepareAPI, controllers.categories.get);

		/* Accounts */
		app.get('/user/:userslug', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getAccount);
		app.get('/api/user/:userslug', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.accounts.getAccount);

		app.get('/user/:userslug/following', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowing);
		app.get('/api/user/:userslug/following', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowing);

		app.get('/user/:userslug/followers', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowers);
		app.get('/api/user/:userslug/followers', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowers);

		app.get('/user/:userslug/favourites', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.getFavourites);
		app.get('/api/user/:userslug/favourites', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.getFavourites);

		app.get('/user/:userslug/posts', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getPosts);
		app.get('/api/user/:userslug/posts', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.accounts.getPosts);

		app.get('/user/:userslug/edit', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);
		app.get('/api/user/:userslug/edit', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);

		// todo: admin recently gained access to this page, pls check if it actually works
		app.get('/user/:userslug/settings', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);
		app.get('/api/user/:userslug/settings', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);

		app.get('/api/user/uid/:uid', middleware.checkGlobalPrivacySettings, controllers.accounts.getUserByUID);

		// this should have been in the API namespace
		// also, perhaps pass in :userslug so we can use checkAccountPermissions middleware, in future will allow admins to upload a picture for a user
		app.post('/user/uploadpicture', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, /*middleware.checkAccountPermissions,*/ controllers.accounts.uploadPicture);

		/* Users */
		app.get('/users', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		// was this duped by accident or purpose?
		app.get('/users/online', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users/online', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		app.get('/users/sort-posts', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);
		app.get('/api/users/sort-posts', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);

		app.get('/users/sort-reputation', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);
		app.get('/api/users/sort-reputation', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);

		app.get('/users/latest', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);
		app.get('/api/users/latest', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);

		app.get('/users/search', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);
		app.get('/api/users/search', middleware.prepareAPI, middleware.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);




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