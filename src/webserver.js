var express = require('express'),
	express_namespace = require('express-namespace'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
	RDB = require('./redis'),
	utils = require('../public/src/utils.js'),
	pkg = require('../package.json'),
	fs = require('fs'),

	user = require('./user.js'),
	categories = require('./categories.js'),
	posts = require('./posts.js'),
	topics = require('./topics.js'),
	notifications = require('./notifications.js'),
	admin = require('./routes/admin.js'),
	userRoute = require('./routes/user.js'),
	apiRoute = require('./routes/api.js'),
	testBed = require('./routes/testbed.js'),
	auth = require('./routes/authentication.js'),
	meta = require('./meta.js'),
	feed = require('./feed'),
	plugins = require('./plugins'),
	nconf = require('nconf');

(function (app) {
	var templates = null;

	/**
	 *	`options` object	requires:	req, res
	 *						accepts:	metaTags
	 */
	app.build_header = function (options, callback) {
		var defaultMetaTags = [{
			name: 'viewport',
			content: 'width=device-width, initial-scale=1.0'
		}, {
			name: 'content-type',
			content: 'text/html; charset=UTF-8'
		}, {
			name: 'apple-mobile-web-app-capable',
			content: 'yes'
		}, {
			property: 'og:site_name',
			content: meta.config.title || 'NodeBB'
		}, ],
			metaString = utils.buildMetaTags(defaultMetaTags.concat(options.metaTags || [])),
			templateValues = {
				cssSrc: meta.config['theme:src'] || nconf.get('relative_path') + '/vendor/bootstrap/css/bootstrap.min.css',
				title: meta.config.title || 'NodeBB',
				browserTitle: meta.config.title || 'NodeBB',
				csrf: options.res.locals.csrf_token,
				relative_path: nconf.get('relative_path'),
				meta_tags: metaString
			};

		callback(null, templates.header.parse(templateValues));
	};

	// Middlewares
	app.use(express.compress());
	app.use(express.favicon(path.join(__dirname, '../', 'public', 'favicon.ico')));
	app.use(require('less-middleware')({
		src: path.join(__dirname, '../', 'public'),
		prefix: nconf.get('relative_path'),
		yuicompress: true
	}));
	app.use(nconf.get('relative_path'), express.static(path.join(__dirname, '../', 'public')));
	app.use(express.bodyParser()); // Puts POST vars in request.body

	app.use(express.cookieParser()); // If you want to parse cookies (res.cookies)
	app.use(express.session({
		store: new RedisStore({
			client: RDB,
			ttl: 60 * 60 * 24 * 30
		}),
		secret: nconf.get('secret'),
		key: 'express.sid',
		cookie: {
			maxAge: 60 * 60 * 24 * 30 * 1000 // 30 days
		}
	}));
	app.use(express.csrf());
	app.use(function (req, res, next) {
		res.locals.csrf_token = req.session._csrf;
		next();
	});

	// Static Directories for NodeBB Plugins
	app.configure(function () {
		var tailMiddlewares = [];

		plugins.ready(function () {
			// Remove some middlewares until the router is gone
			// This is not recommended behaviour: http://stackoverflow.com/a/13691542/122353
			// Also: https://www.exratione.com/2013/03/nodejs-abusing-express-3-to-enable-late-addition-of-middleware/
			tailMiddlewares.push(app.stack.pop());
			tailMiddlewares.push(app.stack.pop());
			tailMiddlewares.push(app.stack.pop());
			for (d in plugins.staticDirs) {
				app.use(nconf.get('relative_path') + '/plugins/' + d, express.static(plugins.staticDirs[d]));
			}

			// Push the removed middlewares back onto the application stack
			tailMiddlewares.reverse();
			app.stack.push(tailMiddlewares.shift());
			app.stack.push(tailMiddlewares.shift());
			app.stack.push(tailMiddlewares.shift());
		});
	});

	module.exports.init = function () {
		templates = global.templates;
		server.listen(nconf.get('PORT') || nconf.get('port'));
	}

	auth.initialize(app);

	app.use(function (req, res, next) {

		nconf.set('https', req.secure);

		next();
	});

	app.use(app.router);

	app.use(function (req, res, next) {
		res.status(404);

		// respond with html page
		if (req.accepts('html')) {
			//res.json('404', { url: req.url });
			res.redirect(nconf.get('relative_path') + '/404');
			return;
		}

		// respond with json
		if (req.accepts('json')) {
			res.send({
				error: 'Not found'
			});
			return;
		}

		// default to plain-text. send()
		res.type('txt').send('Not found');
	});

	app.use(function (err, req, res, next) {

		// we may use properties of the error object
		// here and next(err) appropriately, or if
		// we possibly recovered from the error, simply next().
		console.error(err.stack);

		res.status(err.status || 500);

		res.json('500', {
			error: err.message
		});
	});


	app.create_route = function (url, tpl) { // to remove
		return '<script>templates.ready(function(){ajaxify.go("' + url + '", null, "' + tpl + '");});</script>';
	};


	app.namespace(nconf.get('relative_path'), function () {

		auth.create_routes(app);
		admin.create_routes(app);
		userRoute.create_routes(app);
		testBed.create_routes(app);
		apiRoute.create_routes(app);


		// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
		(function () {
			var routes = ['login', 'register', 'account', 'recent', 'unread', 'popular', 'active', '403', '404'];

			for (var i = 0, ii = routes.length; i < ii; i++) {
				(function (route) {

					app.get('/' + route, function (req, res) {
						if ((route === 'login' || route === 'register') && (req.user && req.user.uid > 0)) {

							user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
								res.redirect('/user/' + userslug);
							});
							return;
						}

						app.build_header({
							req: req,
							res: res
						}, function (err, header) {
							res.send(header + app.create_route(route) + templates['footer']);
						});
					});
				}(routes[i]));
			}
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
					categories.getAllCategories(function (returnData) {
						returnData.categories = returnData.categories.filter(function (category) {
							if (category.disabled !== '1') return true;
							else return false;
						});

						next(null, returnData);
					}, 0);
				}
			}, function (err, data) {
				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/home'].parse(data.categories) + '\n\t</noscript>' +
					app.create_route('') +
					templates['footer']
				);
			})
		});


		app.get('/topic/:topic_id/:slug?', function (req, res) {
			var tid = req.params.topic_id;

			if (tid.match(/^\d+\.rss$/)) {
				tid = tid.slice(0, -4);
				var rssPath = path.join(__dirname, '../', 'feeds/topics', tid + '.rss'),
					loadFeed = function () {
						fs.readFile(rssPath, function (err, data) {
							if (err) res.type('text').send(404, "Unable to locate an rss feed at this location.");
							else res.type('xml').set('Content-Length', data.length).send(data);
						});

					};

				if (!fs.existsSync(rssPath)) {
					feed.updateTopic(tid, function (err) {
						if (err) res.redirect('/404');
						else loadFeed();
					});
				} else loadFeed();

				return;
			}

			async.waterfall([
				function (next) {
					topics.getTopicWithPosts(tid, ((req.user) ? req.user.uid : 0), 0, -1, function (err, topicData) {
						if (topicData) {
							if (topicData.deleted === '1' && topicData.expose_tools === 0)
								return next(new Error('Topic deleted'), null);
						}

						next(err, topicData);
					});
				},
				function (topicData, next) {
					var lastMod = 0,
						timestamp;

					for (var x = 0, numPosts = topicData.posts.length; x < numPosts; x++) {
						timestamp = parseInt(topicData.posts[x].timestamp, 10);
						if (timestamp > lastMod) lastMod = timestamp;
					}

					app.build_header({
						req: req,
						res: res,
						metaTags: [{
							name: "title",
							content: topicData.topic_name
						}, {
							property: 'og:title',
							content: topicData.topic_name + ' | ' + (meta.config.title || 'NodeBB')
						}, {
							property: "og:type",
							content: 'article'
						}, {
							property: "og:url",
							content: nconf.get('url') + 'topic/' + topicData.slug
						}, {
							property: 'og:image',
							content: topicData.main_posts[0].picture
						}, {
							property: "article:published_time",
							content: new Date(parseInt(topicData.main_posts[0].timestamp, 10)).toISOString()
						}, {
							property: 'article:modified_time',
							content: new Date(lastMod).toISOString()
						}, {
							property: 'article:section',
							content: topicData.category_name
						}]
					}, function (err, header) {
						next(err, {
							header: header,
							topics: topicData
						});
					});
				},
			], function (err, data) {
				if (err) return res.redirect('404');
				var topic_url = tid + (req.params.slug ? '/' + req.params.slug : '');

				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/topic'].parse(data.topics) + '\n\t</noscript>' +
					'\n\t<script>templates.ready(function(){ajaxify.go("topic/' + topic_url + '");});</script>' +
					templates['footer']
				);
			});
		});

		app.get('/category/:category_id/:slug?', function (req, res) {
			var cid = req.params.category_id;

			if (cid.match(/^\d+\.rss$/)) {
				cid = cid.slice(0, -4);
				var rssPath = path.join(__dirname, '../', 'feeds/categories', cid + '.rss'),
					loadFeed = function () {
						fs.readFile(rssPath, function (err, data) {
							if (err) res.type('text').send(404, "Unable to locate an rss feed at this location.");
							else res.type('xml').set('Content-Length', data.length).send(data);
						});

					};

				if (!fs.existsSync(rssPath)) {
					feed.updateCategory(cid, function (err) {
						if (err) res.redirect('/404');
						else loadFeed();
					});
				} else loadFeed();

				return;
			}

			async.waterfall([
				function (next) {
					categories.getCategoryById(cid, 0, function (err, categoryData) {

						if (categoryData) {
							if (categoryData.disabled === '1')
								return next(new Error('Category disabled'), null);
						}
						next(err, categoryData);
					});
				},
				function (categoryData, next) {
					app.build_header({
						req: req,
						res: res,
						metaTags: [{
							name: 'title',
							content: categoryData.category_name
						}, {
							name: 'description',
							content: categoryData.category_description
						}, {
							property: "og:type",
							content: 'website'
						}]
					}, function (err, header) {
						next(err, {
							header: header,
							categories: categoryData
						});
					});
				}
			], function (err, data) {
				if (err) return res.redirect('404');
				var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');

				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/category'].parse(data.categories) + '\n\t</noscript>' +
					'\n\t<script>templates.ready(function(){ajaxify.go("category/' + category_url + '");});</script>' +
					templates['footer']
				);
			});
		});

		app.get('/confirm/:code', function (req, res) {
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + '<script>templates.ready(function(){ajaxify.go("confirm/' + req.params.code + '");});</script>' + templates['footer']);
			});
		});

		app.get('/sitemap.xml', function (req, res) {
			var sitemap = require('./sitemap.js');

			sitemap.render(function (xml) {
				res.type('xml').set('Content-Length', xml.length).send(xml);
			});
		});

		app.get('/robots.txt', function (req, res) {
			res.set('Content-Type', 'text/plain');
			res.send("User-agent: *\n" +
				"Disallow: \n" +
				"Disallow: /admin/\n" +
				"Sitemap: " + nconf.get('url') + "sitemap.xml");
		});

		app.get('/cid/:cid', function (req, res) {
			categories.getCategoryData(req.params.cid, function (err, data) {
				if (data)
					res.send(data);
				else
					res.send(404, "Category doesn't exist!");
			});
		});

		app.get('/tid/:tid', function (req, res) {
			topics.getTopicData(req.params.tid, function (data) {
				if (data)
					res.send(data);
				else
					res.send(404, "Topic doesn't exist!");
			});
		});

		app.get('/pid/:pid', function (req, res) {
			posts.getPostData(req.params.pid, function (data) {
				if (data)
					res.send(data);
				else
					res.send(404, "Post doesn't exist!");
			});
		});

		app.get('/outgoing', function (req, res) {
			if (!req.query.url) return res.redirect('/404');

			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(
					header +
					'\n\t<script>templates.ready(function(){ajaxify.go("outgoing?url=' + encodeURIComponent(req.query.url) + '", null, null, true);});</script>' +
					templates['footer']
				);
			});
		});

		app.get('/search', function (req, res) {
			if (!req.user)
				return res.redirect('/403');
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + app.create_route("search", null, "search") + templates['footer']);
			});
		});

		app.get('/search/:term', function (req, res) {
			if (!req.user)
				return res.redirect('/403');
			app.build_header({
				req: req,
				res: res
			}, function (err, header) {
				res.send(header + app.create_route("search/" + req.params.term, null, "search") + templates['footer']);
			});
		});

		app.get('/reindex', function (req, res) {
			topics.reIndexAll(function (err) {
				if (err) {
					return res.json(err);
				}

				user.reIndexAll(function (err) {
					if (err) {
						return res.json(err);
					} else {
						res.send('Topics and users reindexed');
					}
				});
			});
		});
	});
}(WebServer));


global.server = server;