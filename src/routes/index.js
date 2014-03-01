var controllers = require('./../controllers'),
	
	/*temp*/
	plugins = require('./../plugins'),
	metaRoute = require('./meta'),
	apiRoute = require('./api'),
	admin = require('./admin'),
	feedsRoute = require('./feeds');


module.exports = function(app, relativePath) {
	app.namespace(relativePath, function() {
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
		app.get('/', app.buildHeader, controllers.home);
		app.get('/api/home', app.prepareAPI, controllers.home);

		app.get('/login', app.buildHeader, controllers.login);
		app.get('/api/login', app.prepareAPI, controllers.login);

		app.get('/register', app.buildHeader, controllers.register);
		app.get('/api/register', app.prepareAPI, controllers.register);

		app.get('/confirm/:code', app.buildHeader, controllers.confirmEmail);
		app.get('/api/confirm/:code', app.prepareAPI, controllers.confirmEmail);

		app.get('/sitemap.xml', controllers.sitemap);
		app.get('/robots.txt', controllers.robots);

		app.get('/outgoing', app.buildHeader, controllers.outgoing);
		app.get('/api/outgoing', app.prepareAPI, controllers.outgoing);

		/* Static Pages */
		app.get('/404', app.buildHeader, controllers.static['404']);
		app.get('/api/404', app.prepareAPI, controllers.static['404']);

		app.get('/403', app.buildHeader, controllers.static['403']);
		app.get('/api/403', app.prepareAPI, controllers.static['403']);

		app.get('/500', app.buildHeader, controllers.static['500']);
		app.get('/api/500', app.prepareAPI, controllers.static['500']);

		/* Topics */
		app.get('/topic/:topic_id/:slug?', app.buildHeader, controllers.topics.get);
		app.get('/api/topic/:topic_id/:slug?', app.prepareAPI, controllers.topics.get);

		/* Categories */
		app.get('/popular/:set?', app.buildHeader, controllers.categories.popular);
		app.get('/api/popular/:set?', app.prepareAPI, controllers.categories.popular);

		app.get('/recent/:term?', app.buildHeader, controllers.categories.recent);
		app.get('/api/recent/:term?', app.prepareAPI, controllers.categories.recent);

		app.get('/unread/', app.buildHeader, app.authenticate, controllers.categories.unread);
		app.get('/api/unread/', app.prepareAPI, app.authenticate, controllers.categories.unread);

		app.get('/unread/total', app.buildHeader, app.authenticate, controllers.categories.unreadTotal);
		app.get('/api/unread/total', app.prepareAPI, app.authenticate, controllers.categories.unreadTotal);

		app.get('/category/:category_id/:slug?', app.buildHeader, controllers.categories.get);
		app.get('/api/category/:category_id/:slug?', app.prepareAPI, controllers.categories.get);

		/* Accounts */
		app.get('/user/:userslug', app.buildHeader, app.checkGlobalPrivacySettings, controllers.accounts.getAccount);
		app.get('/api/user/:userslug', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.accounts.getAccount);

		app.get('/user/:userslug/following', app.buildHeader, app.checkGlobalPrivacySettings, controllers.accounts.getFollowing);
		app.get('/api/user/:userslug/following', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.accounts.getFollowing);

		app.get('/user/:userslug/followers', app.buildHeader, app.checkGlobalPrivacySettings, controllers.accounts.getFollowers);
		app.get('/api/user/:userslug/followers', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.accounts.getFollowers);

		app.get('/user/:userslug/favourites', app.buildHeader, app.checkGlobalPrivacySettings, app.checkAccountPermissions, controllers.accounts.getFavourites);
		app.get('/api/user/:userslug/favourites', app.prepareAPI, app.checkGlobalPrivacySettings, app.checkAccountPermissions, controllers.accounts.getFavourites);

		app.get('/user/:userslug/posts', app.buildHeader, app.checkGlobalPrivacySettings, controllers.accounts.getPosts);
		app.get('/api/user/:userslug/posts', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.accounts.getPosts);

		app.get('/user/:userslug/edit', app.buildHeader, app.checkGlobalPrivacySettings, app.checkAccountPermissions, controllers.accounts.accountEdit);
		app.get('/api/user/:userslug/edit', app.prepareAPI, app.checkGlobalPrivacySettings, app.checkAccountPermissions, controllers.accounts.accountEdit);

		// todo: admin recently gained access to this page, pls check if it actually works
		app.get('/user/:userslug/settings', app.buildHeader, app.checkGlobalPrivacySettings, app.checkAccountPermissions, controllers.accounts.accountSettings);
		app.get('/api/user/:userslug/settings', app.prepareAPI, app.checkGlobalPrivacySettings, app.checkAccountPermissions, controllers.accounts.accountSettings);

		app.get('/api/user/uid/:uid', app.checkGlobalPrivacySettings, controllers.accounts.getUserByUID);

		// this should have been in the API namespace
		// also, perhaps pass in :userslug so we can use checkAccountPermissions middleware, in future will allow admins to upload a picture for a user
		app.post('/user/uploadpicture', app.prepareAPI, app.checkGlobalPrivacySettings, /*app.checkAccountPermissions,*/ controllers.accounts.uploadPicture);

		/* Users */
		app.get('/users', app.buildHeader, app.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		// was this duped by accident or purpose?
		app.get('/users/online', app.buildHeader, app.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users/online', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		app.get('/users/sort-posts', app.buildHeader, app.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);
		app.get('/api/users/sort-posts', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);

		app.get('/users/sort-reputation', app.buildHeader, app.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);
		app.get('/api/users/sort-reputation', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);

		app.get('/users/latest', app.buildHeader, app.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);
		app.get('/api/users/latest', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);

		app.get('/users/search', app.buildHeader, app.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);
		app.get('/api/users/search', app.prepareAPI, app.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);




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
				res.send(header + app.create_route('search/' + req.params.term, null, 'search') + templates.footer);
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
				var routes = custom_routes.routes;
				for (var route in routes) {
					if (routes.hasOwnProperty(route)) {
						(function(route) {
							app[routes[route].method || 'get'](routes[route].route, function(req, res) {
								routes[route].options(req, res, function(options) {
									app.build_header({
										req: options.req || req,
										res: options.res || res
									}, function (err, header) {
										res.send(header + options.content + templates.footer);
									});
								});
							});
						}(route));
					}
				}

				var apiRoutes = custom_routes.api;
				for (var route in apiRoutes) {
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
				for (var route in templateRoutes) {
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
}