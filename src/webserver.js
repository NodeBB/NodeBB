var path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),
	express_namespace = require('express-namespace'),
	WebServer = express(),
	server,
	winston = require('winston'),
	validator = require('validator'),
	async = require('async'),
	S = require('string'),
	qs = require('querystring'),

	pkg = require('../package.json'),

	utils = require('../public/src/utils'),
	db = require('./database'),
	user = require('./user'),
	categories = require('./categories'),
	CategoryTools = require('./categoryTools'),
	posts = require('./posts'),
	topics = require('./topics'),
	ThreadTools = require('./threadTools'),
	notifications = require('./notifications'),
	admin = require('./routes/admin'),
	userRoute = require('./routes/user'),
	apiRoute = require('./routes/api'),
	auth = require('./routes/authentication'),
	meta = require('./meta'),
	feed = require('./feed'),
	plugins = require('./plugins'),
	logger = require('./logger'),
	templates = require('./../public/src/templates'),
	translator = require('./../public/src/translator');

if(nconf.get('ssl')) {
	server = require('https').createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert)
	}, WebServer);
} else {
	server = require('http').createServer(WebServer);
}

module.exports.server = server;

(function (app) {
	"use strict";

	var	clientScripts;

	plugins.ready(function() {
		// Minify client-side libraries
		meta.js.get(function (err, scripts) {
			clientScripts = scripts.map(function (script) {
				script = {
					script: script
				};

				return script;
			});
		});
	});

	/**
	 *	`options` object	requires:	req, res
	 *						accepts:	metaTags, linkTags
	 */
	app.build_header = function (options, callback) {
		var custom_header = {
			'navigation': []
		};

		plugins.fireHook('filter:header.build', custom_header, function(err, custom_header) {
			var defaultMetaTags = [{
					name: 'viewport',
					content: 'width=device-width, initial-scale=1.0, user-scalable=no'
				}, {
					name: 'content-type',
					content: 'text/html; charset=UTF-8'
				}, {
					name: 'apple-mobile-web-app-capable',
					content: 'yes'
				}, {
					property: 'og:site_name',
					content: meta.config.title || 'NodeBB'
				}, {
					property: 'keywords',
					content: meta.config.keywords || ''
				}],
				defaultLinkTags = [{
					rel: 'apple-touch-icon',
					href: meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png'
				}],
				templateValues = {
					bootswatchCSS: meta.config['theme:src'],
					pluginCSS: plugins.cssFiles.map(function(file) { return { path: nconf.get('relative_path') + file.replace(/\\/g, '/') }; }),
					title: meta.config.title || '',
					description: meta.config.description || '',
					'brand:logo': meta.config['brand:logo'] || '',
					'brand:logo:display': meta.config['brand:logo']?'':'hide',
					csrf: options.res.locals.csrf_token,
					relative_path: nconf.get('relative_path'),
					clientScripts: clientScripts,
					navigation: custom_header.navigation,
					'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
					allowRegistration: meta.config.allowRegistration === undefined || parseInt(meta.config.allowRegistration, 10) === 1
				},
				escapeList = {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					"'": '&apos;',
					'"': '&quot;'
				};

			var uid = '0';

			// Meta Tags
			templateValues.metaTags = defaultMetaTags.concat(options.metaTags || []).map(function(tag) {
				tag.content = tag.content.replace(/[&<>'"]/g, function(tag) {
					return escapeList[tag] || tag;
				});
				return tag;
			});

			// Link Tags
			templateValues.linkTags = defaultLinkTags.concat(options.linkTags || []);
			templateValues.linkTags.push({
				rel: "icon",
				type: "image/x-icon",
				href: meta.config['brand:favicon'] || nconf.get('relative_path') + '/favicon.ico'
			});

			// Browser Title
			var	metaTitle = templateValues.metaTags.filter(function(tag) {
				return tag.property === 'og:title';
			});
			if (metaTitle.length > 0 && metaTitle[0].content) {
				templateValues.browserTitle = metaTitle[0].content;
			} else {
				templateValues.browserTitle = meta.config.browserTitle || 'NodeBB';
			}

			if(options.req.user && options.req.user.uid) {
				uid = options.req.user.uid;
			}

			// Custom CSS
			templateValues.useCustomCSS = false;
			if (meta.config.useCustomCSS === '1') {
				templateValues.useCustomCSS = true;
				templateValues.customCSS = meta.config.customCSS;
			}

			user.isAdministrator(uid, function(err, isAdmin) {
				templateValues.isAdmin = isAdmin;

				translator.translate(templates.header.parse(templateValues), function(template) {
					callback(null, template);
				});
			});


		});
	};

	// Cache static files on production
	if (global.env !== 'development') {
		app.enable('cache');
		app.enable('minification');

		// Configure cache-buster timestamp
		require('child_process').exec('git describe --tags', {
			cwd: path.join(__dirname, '../')
		}, function(err, stdOut) {
			if (!err) {
				meta.config['cache-buster'] = stdOut.trim();
				// winston.info('[init] Cache buster value set to: ' + stdOut);
			} else {
				winston.warn('[init] Cache buster not set');
			}
		});
	}

	// Middlewares
	app.configure(function() {
		async.series([
			function(next) {
				// Pre-router middlewares
				app.use(express.compress());

				logger.init(app);

				app.use(express.favicon(path.join(__dirname, '../', 'public', 'favicon.ico')));
				app.use(require('less-middleware')({
					src: path.join(__dirname, '../', 'public'),
					prefix: nconf.get('relative_path'),
					yuicompress: app.enabled('minification') ? true : false
				}));
				app.use(express.bodyParser()); // Puts POST vars in request.body
				app.use(express.cookieParser()); // If you want to parse cookies (res.cookies)

				app.use(express.session({
					store: db.sessionStore,
					secret: nconf.get('secret'),
					key: 'express.sid',
					cookie: {
						maxAge: 60 * 60 * 24 * 30 * 1000 // 30 days
					}
				}));

				app.use(express.csrf());

				if (nconf.get('port') != 80 && nconf.get('port') != 443 && nconf.get('use_port') === true) {
					winston.info('Enabling \'trust proxy\'');
					app.enable('trust proxy');
				}

				if ((nconf.get('port') == 80 || nconf.get('port') == 443) && process.env.NODE_ENV !== 'development') {
					winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
				}

				// Local vars, other assorted setup
				app.use(function (req, res, next) {
					res.locals.csrf_token = req.session._csrf;

					// Disable framing
					res.setHeader('X-Frame-Options', 'SAMEORIGIN');

					next();
				});

				// Authentication Routes
				auth.initialize(app);

				app.use(function(req, res, next) {
					if(req.user) {
						user.setUserField(req.user.uid, 'lastonline', Date.now());
					}
					next();
				});

				next();
			},
			function(next) {
				async.parallel([
					function(next) {

						db.getObjectFields('config', ['theme:type', 'theme:id', 'theme:staticDir', 'theme:templates'], function(err, themeData) {
							var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla');

							// Detect if a theme has been selected, and handle appropriately
							if (!themeData['theme:type'] || themeData['theme:type'] === 'local') {
								// Local theme
								if (process.env.NODE_ENV === 'development') {
									winston.info('[themes] Using theme ' + themeId);
								}

								// Theme's static directory
								if (themeData['theme:staticDir']) {
									app.use('/css/assets', express.static(path.join(__dirname, '../node_modules', themeData['theme:id'], themeData['theme:staticDir']), {
										maxAge: app.enabled('cache') ? 5184000000 : 0
									}));
									if (process.env.NODE_ENV === 'development') {
										winston.info('Static directory routed for theme: ' + themeData['theme:id']);
									}
								}

								if (themeData['theme:templates']) {
									app.use('/templates', express.static(path.join(__dirname, '../node_modules', themeData['theme:id'], themeData['theme:templates']), {
										maxAge: app.enabled('cache') ? 5184000000 : 0
									}));
									if (process.env.NODE_ENV === 'development') {
										winston.info('Custom templates directory routed for theme: ' + themeData['theme:id']);
									}
								}

								app.use(require('less-middleware')({
									src: path.join(__dirname, '../node_modules/' + themeId),
									dest: path.join(__dirname, '../public/css'),
									prefix: nconf.get('relative_path') + '/css',
									yuicompress: app.enabled('minification') ? true : false
								}));

								next();
							} else {
								// If not using a local theme (bootswatch, etc), drop back to vanilla
								if (process.env.NODE_ENV === 'development') {
									winston.info('[themes] Using theme ' + themeId);
								}

								app.use(require('less-middleware')({
									src: path.join(__dirname, '../node_modules/nodebb-theme-vanilla'),
									dest: path.join(__dirname, '../public/css'),
									prefix: nconf.get('relative_path') + '/css',
									yuicompress: app.enabled('minification') ? true : false
								}));

								next();
							}
						});

						// Route paths to screenshots for installed themes
						meta.themes.get(function(err, themes) {
							var	screenshotPath;

							async.each(themes, function(themeObj, next) {
								if (themeObj.screenshot) {
									screenshotPath = path.join(__dirname, '../node_modules', themeObj.id, themeObj.screenshot);
									(function(id, path) {
										fs.exists(path, function(exists) {
											if (exists) {
												app.get('/css/previews/' + id, function(req, res) {
													res.sendfile(path);
												});
											}
										});
									})(themeObj.id, screenshotPath);
								} else {
									next(false);
								}
							});
						});
					}
				], next);
			},
			function(next) {
				// Router & post-router middlewares
				app.use(app.router);

				// Static directory /public
				app.use(nconf.get('relative_path'), express.static(path.join(__dirname, '../', 'public'), {
					maxAge: app.enabled('cache') ? 5184000000 : 0
				}));

				// 404 catch-all
				app.use(function (req, res, next) {
					var	isLanguage = new RegExp('^' + nconf.get('relative_path') + '/language/[\\w]{2,}/.*.json'),
						isClientScript = new RegExp('^' + nconf.get('relative_path') + '\\/src\\/forum(\\/admin)?\\/[\\w]+\\.js');

					res.status(404);

					if (isClientScript.test(req.url)) {
						// Handle missing client-side scripts
						res.type('text/javascript').send(200, '');
					} else if (isLanguage.test(req.url)) {
						// Handle languages by sending an empty object
						res.json(200, {});
					} else if (req.accepts('html')) {
						// respond with html page
						if (process.env.NODE_ENV === 'development') {
							winston.warn('Route requested but not found: ' + req.url);
						}

						res.redirect(nconf.get('relative_path') + '/404');
					} else if (req.accepts('json')) {
						// respond with json
						if (process.env.NODE_ENV === 'development') {
							winston.warn('Route requested but not found: ' + req.url);
						}

						res.json({
							error: 'Not found'
						});
					} else {
						// default to plain-text. send()
						res.type('txt').send('Not found');
					}
				});

				app.use(function (err, req, res, next) {

					// we may use properties of the error object
					// here and next(err) appropriately, or if
					// we possibly recovered from the error, simply next().
					console.error(err.stack);
					var status = err.status || 500;
					res.status(status);

					res.json(status, {
						error: err.message
					});
				});

				next();
			}
		], function(err) {
			if (err) {
				winston.error('Errors were encountered while attempting to initialise NodeBB.');
				process.exit();
			} else {
				if (process.env.NODE_ENV === 'development') {
					winston.info('Middlewares loaded.');
				}
			}
		});
	});

	module.exports.init = function () {
		// translate all static templates served by webserver here. ex. footer, logout
		plugins.fireHook('filter:footer.build', '', function(err, appendHTML) {
			var footer = templates.footer.parse({
				footerHTML: appendHTML
			});

			translator.translate(footer, function(parsedTemplate) {
				templates.footer = parsedTemplate;
			});
		});

		plugins.fireHook('action:app.load', app);

		translator.translate(templates.logout.toString(), function(parsedTemplate) {
			templates.logout = parsedTemplate;
		});

		winston.info('NodeBB Ready');
		server.listen(nconf.get('PORT') || nconf.get('port'), nconf.get('bind_address'));
	};

	app.create_route = function (url, tpl) { // to remove
		var	routerScript = '<script> \
				ajaxify.initialLoad = true; \
				templates.ready(function(){ajaxify.go("' + url + '", null, true);}); \
			</script>';

		return routerScript;
	};

	app.namespace(nconf.get('relative_path'), function () {

		auth.registerApp(app);
		admin.createRoutes(app);
		userRoute.createRoutes(app);
		apiRoute.createRoutes(app);

		// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
		(function () {
			var routes = ['login', 'register', 'account', 'recent', 'popular', '403', '404', '500'],
				loginRequired = ['unread', 'notifications'];

			async.each(routes.concat(loginRequired), function(route, next) {
				app.get('/' + route, function (req, res) {

					if ((route === 'register' || route === 'login') && (req.user && req.user.uid > 0)) {
						user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
							res.redirect('/user/' + userslug);
						});
						return;
					} else if(route === 'register' && meta.config.allowRegistration !== undefined && parseInt(meta.config.allowRegistration, 10) === 0) {
						return res.redirect('/403');
					} else if (loginRequired.indexOf(route) !== -1 && !req.user) {
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
		}());


		app.get('/', function (req, res) {
			async.parallel({
				"header": function (next) {
					app.build_header({
						req: req,
						res: res,
						metaTags: [{
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
						}]
					}, next);
				},
				"categories": function (next) {
					function canSee(category, next) {
						CategoryTools.privileges(category.cid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
							next(!err && privileges.read);
						});
					}

					categories.getAllCategories(0, function (err, returnData) {
						returnData.categories = returnData.categories.filter(function (category) {
							return parseInt(category.disabled, 10) !== 1;
						});

						async.filter(returnData.categories, canSee, function(visibleCategories) {
							returnData.categories = visibleCategories;
							next(null, returnData);
						});
					});
				}
			}, function (err, data) {
				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/home'].parse(data.categories) + '\n\t</noscript>' +
					app.create_route('') +
					templates.footer
				);
			});
		});

		app.get('/topic/:topic_id/:slug?', function (req, res, next) {
			var tid = req.params.topic_id;

			if (tid.match(/^\d+\.rss$/)) {
				tid = tid.slice(0, -4);
				var rssPath = path.join(__dirname, '../', 'feeds/topics', tid + '.rss'),
					loadFeed = function () {
						fs.readFile(rssPath, function (err, data) {
							if (err) {
								res.type('text').send(404, "Unable to locate an rss feed at this location.");
							} else {
								res.type('xml').set('Content-Length', data.length).send(data);
							}
						});

					};

				ThreadTools.privileges(tid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
					if(err) {
						return next(err);
					}

					if(!privileges.read) {
						return res.redirect('403');
					}

					if (!fs.existsSync(rssPath)) {
						feed.updateTopic(tid, function (err) {
							if (err) {
								res.redirect('/404');
							} else {
								loadFeed();
							}
						});
					} else {
						loadFeed();
					}
				});

				return;
			}

			async.waterfall([
				function(next) {
					ThreadTools.privileges(tid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
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
					topics.getTopicWithPosts(tid, ((req.user) ? req.user.uid : 0), 0, -1, true, function (err, topicData) {
						if (topicData) {
							if (parseInt(topicData.deleted, 10) === 1 && parseInt(topicData.expose_tools, 10) === 0) {
								return next(new Error('Topic deleted'), null);
							}
						}

						next(err, topicData);
					});
				},
				function (topicData, next) {

					var lastMod = topicData.timestamp,
						sanitize = validator.sanitize,
						description = (function() {
							var	content = '';
							if(topicData.posts.length) {
								content = S(topicData.posts[0].content).stripTags().s;
							}

							if (content.length > 255) {
								content = content.substr(0, 255) + '...';
							}

							return sanitize(content).escape();
						})(),
						timestamp;

					for (var x = 0, numPosts = topicData.posts.length; x < numPosts; x++) {
						timestamp = parseInt(topicData.posts[x].timestamp, 10);
						if (timestamp > lastMod) {
							lastMod = timestamp;
						}
					}

					app.build_header({
						req: req,
						res: res,
						metaTags: [
							{
								name: "title",
								content: topicData.topic_name
							},
							{
								name: "description",
								content: description
							},
							{
								property: 'og:title',
								content: topicData.topic_name
							},
							{
								property: 'og:description',
								content: description
							},
							{
								property: "og:type",
								content: 'article'
							},
							{
								property: "og:url",
								content: nconf.get('url') + '/topic/' + topicData.slug
							},
							{
								property: "og:image:url",
								content: nconf.get('url') + (meta.config['brand:logo']?meta.config['brand:logo']:'')
							},
							{
								property: 'og:image',
								content: topicData.posts.length?topicData.posts[0].picture:''
							},
							{
								property: "article:published_time",
								content: utils.toISOString(topicData.timestamp)
							},
							{
								property: 'article:modified_time',
								content: utils.toISOString(lastMod)
							},
							{
								property: 'article:section',
								content: topicData.category_name
							}
						],
						linkTags: [
							{
								rel: 'alternate',
								type: 'application/rss+xml',
								href: nconf.get('url') + '/topic/' + tid + '.rss'
							},
							{
								rel: 'up',
								href: nconf.get('url') + '/category/' + topicData.category_slug
							}
						]
					}, function (err, header) {
						next(err, {
							header: header,
							topics: topicData
						});
					});
				},
			], function (err, data) {
				if (err) {
					if (err.message === 'not-enough-privileges') {
						return res.redirect('403');
					} else {
						return res.redirect('404');
					}
				}

				var topic_url = tid + (req.params.slug ? '/' + req.params.slug : '');
				var queryString = qs.stringify(req.query);
				if(queryString.length) {
					topic_url += '?' + queryString;
				}

				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/topic'].parse(data.topics) + '\n\t</noscript>' +
					'\n\t' + app.create_route('topic/' + topic_url) + templates.footer
				);
			});
		});

		app.get('/category/:category_id/:slug?', function (req, res, next) {
			var cid = req.params.category_id;

			if (cid.match(/^\d+\.rss$/)) {
				cid = cid.slice(0, -4);
				var rssPath = path.join(__dirname, '../', 'feeds/categories', cid + '.rss'),
					loadFeed = function () {
						fs.readFile(rssPath, function (err, data) {
							if (err) {
								res.type('text').send(404, "Unable to locate an rss feed at this location.");
							} else {
								res.type('xml').set('Content-Length', data.length).send(data);
							}
						});

					};

				CategoryTools.privileges(cid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
					if(err) {
						return next(err);
					}

					if(!privileges.read) {
						return res.redirect('403');
					}

					if (!fs.existsSync(rssPath)) {
						feed.updateCategory(cid, function (err) {
							if (err) {
								res.redirect('/404');
							} else {
								loadFeed();
							}
						});
					} else {
						loadFeed();
					}
				});

				return;
			}

			async.waterfall([
				function(next) {
					CategoryTools.privileges(cid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
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
					categories.getCategoryById(cid, 0, -1, 0, function (err, categoryData) {

						if (categoryData) {
							if (parseInt(categoryData.disabled, 10) === 1) {
								return next(new Error('Category disabled'), null);
							}
						}

						next(err, categoryData);
					});
				},
				function (categoryData, next) {
					app.build_header({
						req: req,
						res: res,
						metaTags: [
							{
								name: 'title',
								content: categoryData.category_name
							},
							{
								property: 'og:title',
								content: categoryData.category_name
							},
							{
								name: 'description',
								content: categoryData.category_description
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
							categories: categoryData
						});
					});
				}
			], function (err, data) {
				if (err) {
					if (err.message === 'not-enough-privileges') {
						return res.redirect('403');
					} else {
						return res.redirect('404');
					}
				}

				if(data.categories.link) {
					return res.redirect(data.categories.link);
				}

				var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');
				var queryString = qs.stringify(req.query);
				if(queryString.length) {
					category_url += '?' + queryString;
				}

				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/category'].parse(data.categories) + '\n\t</noscript>' +
					'\n\t' + app.create_route('category/' + category_url) + templates.footer
				);
			});
		});

		app.get('/confirm/:code', function (req, res) {
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + app.create_route('confirm/' + req.params.code) + templates.footer);
			});
		});

		app.get('/sitemap.xml', function (req, res) {
			var sitemap = require('./sitemap.js');

			sitemap.render(function (xml) {
				res.header('Content-Type', 'application/xml');
				res.send( xml );
			});
		});

		app.get('/robots.txt', function (req, res) {
			res.set('Content-Type', 'text/plain');

			if (meta.config["robots.txt"]) {
				res.send(meta.config["robots.txt"])
			} else {
				res.send("User-agent: *\n" +
					"Disallow: /admin/\n" +
					"Sitemap: " + nconf.get('url') + "/sitemap.xml");
			}
		});

		app.get('/recent.rss', function(req, res) {
			var rssPath = path.join(__dirname, '../', 'feeds/recent.rss');

			if (!fs.existsSync(rssPath)) {
				feed.updateRecent(function (err) {
					if (err) {
						res.redirect('/404');
					} else {
						feed.loadFeed(rssPath, res);
					}
				});
			} else {
				feed.loadFeed(rssPath, res);
			}
		});

		app.get('/popular.rss', function(req, res) {
			var rssPath = path.join(__dirname, '../', 'feeds/popular.rss');

			feed.updatePopular(function (err) {
				if (err) {
					res.redirect('/404');
				} else {
					feed.loadFeed(rssPath, res);
				}
			});
		});

		app.get('/recent/:term?', function (req, res) {
			// TODO consolidate with /recent route as well -> that can be combined into this area. See "Basic Routes" near top.
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + app.create_route('recent/' + req.params.term, null, 'recent') + templates.footer);
			});

		});

		app.get('/popular/:term?', function (req, res) {
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + app.create_route('popular/' + req.params.term, null, 'popular') + templates.footer);
			});

		});

		app.get('/outgoing', function (req, res) {
			if (!req.query.url) {
				return res.redirect('/404');
			}

			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + app.create_route('outgoing?url=' + encodeURIComponent(req.query.url)) + templates.footer);
			});
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
				res.send(header + app.create_route('search/' + req.params.term, null, 'search') + templates.footer);
			});
		});

		// Other routes
		require('./routes/plugins')(app);

		// Debug routes
		if (process.env.NODE_ENV === 'development') {
			require('./routes/debug')(app);
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
		}

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
}(WebServer));
