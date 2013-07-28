var express = require('express'),
	express_namespace = require('express-namespace'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
	redis = require('redis'),
	redisServer = redis.createClient(global.nconf.get('redis:port'), global.nconf.get('redis:host')),
	marked = require('marked'),
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
	installRoute = require('./routes/install.js'),
	testBed = require('./routes/testbed.js'),
	auth = require('./routes/authentication.js'),
	meta = require('./meta.js');

(function(app) {
	var templates = null;
	
	/**
	 *	`options` object	requires:	req, res
	 *						accepts:	metaTags
	 */
	app.build_header = function(options, callback) {
		var	defaultMetaTags = [
				{ name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
				{ name: 'content-type', content: 'text/html; charset=UTF-8' },
				{ name: 'apple-mobile-web-app-capable', content: 'yes' },
				{ property: 'og:site_name', content: global.config.title || 'NodeBB' },
			],
			metaString = utils.buildMetaTags(defaultMetaTags.concat(options.metaTags || [])),
			templateValues = {
				cssSrc: global.config['theme:src'] || global.nconf.get('relative_path') + '/vendor/bootstrap/css/bootstrap.min.css',
				title: global.config['title'] || 'NodeBB',
				csrf: options.res.locals.csrf_token,
				relative_path: global.nconf.get('relative_path'),
				meta_tags: metaString
			};

		meta.build_title(options.title, (options.req.user ? options.req.user.uid : 0), function(err, title) {
			if (!err) templateValues.browserTitle = title;

			callback(null, templates['header'].parse(templateValues));
		});
	};

	// Middlewares
	app.use(express.favicon(path.join(__dirname, '../', 'public', 'favicon.ico')));
	app.use(require('less-middleware')({ src: path.join(__dirname, '../', 'public') }));
	app.use(global.nconf.get('relative_path'), express.static(path.join(__dirname, '../', 'public')));
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.compress());
	app.use(express.session({
		store: new RedisStore({
			client: redisServer,
			ttl: 60*60*24*14
		}),
		secret: global.nconf.get('secret'),
		key: 'express.sid'
	}));
	app.use(express.csrf());
	app.use(function(req, res, next) {
		res.locals.csrf_token = req.session._csrf;
		next();
	});

	module.exports.init = function() {
		templates = global.templates;
	}

	auth.initialize(app);
	
	app.use(function(req, res, next) {
		
		global.nconf.set('https', req.secure);
		
		// Don't bother with session handling for API requests
		if (/^\/api\//.test(req.url)) return next();

		if (req.user && req.user.uid) {
			user.session_ping(req.sessionID, req.user.uid);
		}

		// (Re-)register the session as active
		user.active.register(req.sessionID);

		next();
	});
	
	app.use(app.router);

	app.use(function(req, res, next) {
		res.status(404);

		// respond with html page
		if (req.accepts('html')) {
			
			//res.json('404', { url: req.url });
			res.redirect(global.nconf.get('relative_path') + '/404');
			return;
		}

		// respond with json
		if (req.accepts('json')) {
			console.log('sending 404 json');
			res.send({ error: 'Not found' });
			return;
		}
		
		// default to plain-text. send()
		res.type('txt').send('Not found');
	});

	app.use(function(err, req, res, next) {
		// we may use properties of the error object
		// here and next(err) appropriately, or if
		// we possibly recovered from the error, simply next().
		console.error(err.stack);
		
		res.status(err.status || 500);
		
		res.json('500', { error: err.message });
	});	
	

	app.create_route = function(url, tpl) { // to remove
		return '<script>templates.ready(function(){ajaxify.go("' + url + '", null, "' + tpl + '");});</script>';
	};
	

	app.namespace(global.nconf.get('relative_path'), function() {

		auth.create_routes(app);
		admin.create_routes(app);
		userRoute.create_routes(app);
		installRoute.create_routes(app);
		testBed.create_routes(app);
		
		
		
		// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
		(function() {
			var routes = ['login', 'register', 'account', 'recent', 'popular', 'active', '403', '404'];
	
			for (var i=0, ii=routes.length; i<ii; i++) {
				(function(route) {
					
					app.get('/' + route, function(req, res) {
						if ((route === 'login' || route ==='register') && (req.user && req.user.uid > 0)) {
							
							user.getUserField(req.user.uid, 'userslug', function(userslug) {
								res.redirect('/users/'+userslug);							
							});
							return;
						}

						app.build_header({ req: req, res: res }, function(err, header) {
							res.send(header + app.create_route(route) + templates['footer']);
						});
					});
				}(routes[i]));
			}
		}());
		

		app.get('/', function(req, res) {
			async.parallel({
				"header": function(next) {
					app.build_header({
						req: req,
						res: res,
						metaTags: [
							{ name: "title", content: global.config.title || 'NodeBB' },
							{ name: "description", content: global.config.description || '' },
							{ property: 'og:title', content: 'Index | ' + (global.config.title || 'NodeBB') },
							{ property: "og:type", content: 'website' }
						]
					}, next);
				},
				"categories": function(next) {
					categories.getAllCategories(function(returnData) {
						next(null, returnData);
					}, 0);
				}
			}, function(err, data) {
				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/home'].parse(data.categories) + '\n\t</noscript>' +
					app.create_route('') +
					templates['footer']
				);
			})
		});
	

		app.get('/topic/:topic_id/:slug?', function(req, res) {
			var tid = req.params.topic_id;
			if (tid.match(/^\d+\.rss$/)) {
				fs.readFile('feeds/topics/' + tid, function (err, data) {
					if (err) {
						res.type('text').send(404, "Unable to locate an rss feed at this location.");
						return;
					}
					
					res.type('xml').set('Content-Length', data.length).send(data);
				});
				return;
			}

			async.waterfall([
				function(next) {
					topics.getTopicWithPosts(tid, ((req.user) ? req.user.uid : 0), function(err, topicData) {
						next(err, topicData);
					});
				},
				function(topicData, next) {
					var	posts = topicData.posts.push(topicData.main_posts[0]),
						lastMod = 0,
						timestamp;
					for(var x=0,numPosts=topicData.posts.length;x<numPosts;x++) {
						timestamp = parseInt(topicData.posts[x].timestamp, 10);
						if (timestamp > lastMod) lastMod = timestamp;
					}

					app.build_header({
						req: req,
						res: res,
						title: topicData.topic_name,
						metaTags: [
							{ name: "title", content: topicData.topic_name },
							{ property: 'og:title', content: topicData.topic_name + ' | ' + (global.config.title || 'NodeBB') },
							{ property: "og:type", content: 'article' },
							{ property: "og:url", content: global.nconf.get('url') + 'topic/' + topicData.slug },
							{ property: 'og:image', content: topicData.main_posts[0].picture },
							{ property: "article:published_time", content: new Date(parseInt(topicData.main_posts[0].timestamp, 10)).toISOString() },
							{ property: 'article:modified_time', content: new Date(lastMod).toISOString() },
							{ property: 'article:section', content: topicData.category_name }
						]
					}, function(err, header) {
						next(err, {
							header: header,
							topics: topicData
						});
					});
				},
			], function(err, data) {
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

		app.get('/category/:category_id/:slug?', function(req, res) {
			var cid = req.params.category_id;
			
			if (cid.match(/^\d+\.rss$/)) {
				fs.readFile('feeds/categories/' + cid, function (err, data) {
					if (err) {
						res.type('text').send(404, "Unable to locate an rss feed at this location.");
						return;
					}

					res.type('xml').set('Content-Length', data.length).send(data);
				});
				return;
			}

			async.waterfall([
				function(next) {
					categories.getCategoryById(cid, 0, function(err, categoryData) {
						next(err, categoryData);
					});
				},
				function(categoryData, next) {
					app.build_header({
						req: req,
						res: res,
						title: categoryData.category_name,
						metaTags: [
							{ name: 'title', content: categoryData.category_name },
							{ name: 'description', content: categoryData.category_description },
							{ property: "og:type", content: 'website' }
						]
					}, function(err, header) {
						next(err, {
							header: header,
							categories: categoryData
						});
					});
				}
			], function(err, data) {
				if(err) return res.redirect('404');
				var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');

				res.send(
					data.header +
					'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/category'].parse(data.categories) + '\n\t</noscript>' +
					'\n\t<script>templates.ready(function(){ajaxify.go("category/' + category_url + '");});</script>' +
					templates['footer']
				);
			});
		});

		app.get('/confirm/:code', function(req, res) {
			app.build_header({ req: req, res: res }, function(header) {
				res.send(header + '<script>templates.ready(function(){ajaxify.go("confirm/' + req.params.code + '");});</script>' + templates['footer']);
			});
		});

		app.get('/sitemap.xml', function(req, res) {
			var	sitemap = require('./sitemap.js');

			sitemap.render(function(xml) {
				res.type('xml').set('Content-Length', xml.length).send(xml);
			});
		});

		app.get('/robots.txt', function(req, res) {
			res.set('Content-Type', 'text/plain');
			res.send(	"User-agent: *\n" +
						"Disallow: \n" +
						"Disallow: /admin/\n" +
						"Sitemap: " + global.nconf.get('url') + "sitemap.xml");
		});

		app.get('/api/:method', api_method);
		app.get('/api/:method/:id', api_method);
		// ok fine MUST ADD RECURSION style. I'll look for a better fix in future but unblocking baris for this:
		app.get('/api/:method/:id/:section?', api_method);
		app.get('/api/:method/:id*', api_method);

		app.get('/cid/:cid', function(req, res) {
			categories.getCategoryData(req.params.cid, function(err, data) {
				if(data)
					res.send(data);
				else
					res.send(404, "Category doesn't exist!");
			});
		});

		app.get('/tid/:tid', function(req, res) {
			topics.getTopicData(req.params.tid, function(data){
				if(data)
					res.send(data);
				else
					res.send(404, "Topic doesn't exist!");
			});
		});

		app.get('/pid/:pid', function(req, res) {
			posts.getPostData(req.params.pid, function(data){
				if(data)
					res.send(data);
				else
					res.send(404, "Post doesn't exist!");
			});
		});

		app.get('/outgoing', function(req, res) {
			var url = req.url.split('?');

			if (url[1]) {
				app.build_header({ req: req, res: res }, function(header) {
					res.send(header + templates['outgoing'].parse({
						url: url[1],
						home: global.nconf.get('url')
					}) + templates['footer']);
				});
			} else {
				res.status(404);
				res.redirect(global.nconf.get('relative_path') + '/404');
			}
		});

	});
	
	// These functions are called via ajax once the initial page is loaded to populate templates with data
	function api_method(req, res) {
		var uid = (req.user) ? req.user.uid : 0;
		
		switch(req.params.method) {
			case 'get_templates_listing' :
					utils.walk(global.configuration.ROOT_DIRECTORY + '/public/templates', function(err, data) {
						res.json(data);
					});
				break;
			case 'home' :
					categories.getAllCategories(function(data) {
						
						var async = require('async');
						
						function iterator(category, callback) {
							categories.getRecentReplies(category.cid, 2, function(posts) {
								category["posts"] = posts;
								category["post_count"] = posts.length>2 ? 2 : posts.length;
								callback(null);
							});
						}
						
						async.each(data.categories, iterator, function(err) {
							data.motd_class = (config.show_motd === '1' || config.show_motd === undefined) ? '' : 'none';
							data.motd = marked(config.motd || "# NodeBB v" + pkg.version + "\nWelcome to NodeBB, the discussion platform of the future.\n\n<a target=\"_blank\" href=\"http://www.nodebb.org\" class=\"btn btn-large\"><i class=\"icon-comment\"></i> Get NodeBB</a> <a target=\"_blank\" href=\"https://github.com/designcreateplay/NodeBB\" class=\"btn btn-large\"><i class=\"icon-github-alt\"></i> Fork us on Github</a> <a target=\"_blank\" href=\"https://twitter.com/dcplabs\" class=\"btn btn-large\"><i class=\"icon-twitter\"></i> @dcplabs</a>");
							res.json(data);							
						});
						

					}, uid);
				break;
			case 'login' :
					var data = {},
						login_strategies = auth.get_login_strategies(),
						num_strategies = login_strategies.length;

					if (num_strategies == 0) {
						data = {
							'login_window:spansize': 'span12',
							'alternate_logins:display': 'none'
						};	
					} else {
						data = {
							'login_window:spansize': 'span6',
							'alternate_logins:display': 'block'
						}
						for (var i=0, ii=num_strategies; i<ii; i++) {
							data[login_strategies[i] + ':display'] = 'active';
						}
					}

					data.token = res.locals.csrf_token;

					res.json(data);
				break;
			case 'register' :
					var data = {},
						login_strategies = auth.get_login_strategies(),
						num_strategies = login_strategies.length;

					if (num_strategies == 0) {
						data = {
							'register_window:spansize': 'span12',
							'alternate_logins:display': 'none'
						};	
					} else {
						data = {
							'register_window:spansize': 'span6',
							'alternate_logins:display': 'block'
						}
						for (var i=0, ii=num_strategies; i<ii; i++) {
							data[login_strategies[i] + ':display'] = 'active';
						}
					}

					data.token = res.locals.csrf_token;

					res.json(data);
				break;
			case 'topic' :
					topics.getTopicWithPosts(req.params.id, uid, function(err, data) {
						res.json(data);
					});
				break;
			case 'category' :
					categories.getCategoryById(req.params.id, uid, function(err, data) {
						if (!err) res.json(data);
						else res.send(404);
					}, req.params.id, uid);
				break;
			case 'recent' :
					topics.getLatestTopics(uid, 0, 9, function(data) {
						res.json(data);
					});
				break;
			case 'popular' :
					topics.getLatestTopics(uid, 0, 9, function(data) {
						res.json(data);
					});
				break;
			case 'active' :
					topics.getLatestTopics(uid, 0, 9, function(data) {
						res.json(data);
					});
				break;
			case 'confirm':
					user.email.confirm(req.params.id, function(data) {
						if (data.status === 'ok') {
							res.json({
								'alert-class': 'alert-success',
								title: 'Email Confirmed',
								text: 'Thank you for vaidating your email. Your account is now fully activated.'
							});
						} else {
							res.json({
								'alert-class': 'alert-error',
								title: 'An error occurred...',
								text: 'There was a problem validating your email address. Perhaps the code was invalid or has expired.'
							});
						}
					});
				break;
			case 'outgoing' :
				var url = req.url.split('?');

				if (url[1]) {
					res.json({
						url: url[1],
						home: global.nconf.get('url')
					});
				} else {
					res.status(404);
					res.redirect(global.nconf.get('relative_path') + '/404');
				}
				break;
			default :
				res.json(404, { error: 'unrecognized API endpoint' });
			break;
		}
	}
}(WebServer));

server.listen(nconf.get('port'));
global.server = server;
