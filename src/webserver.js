var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
	redis = require('redis'),
	redisServer = redis.createClient(global.config.redis.port, global.config.redis.host),
	marked = require('marked'),
	utils = require('../public/src/utils.js'),
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
	
	app.build_header = function(res) {
		return templates['header'].parse({
			cssSrc: global.config['theme:src'] || '/vendor/bootstrap/css/bootstrap.min.css',
			title: global.config['title'] || 'NodeBB',
			csrf:res.locals.csrf_token
		});
	};

	// Middlewares
	app.use(express.favicon(path.join(__dirname, '../', 'public', 'favicon.ico')));
	app.use(require('less-middleware')({ src: path.join(__dirname, '../', 'public') }));
	app.use(express.static(path.join(__dirname, '../', 'public')));
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.compress());
	app.use(express.session({
		store: new RedisStore({
			client: redisServer,
			ttl: 60*60*24*14
		}),
		secret: global.config.secret,
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
		// Don't bother with session handling for API requests
		if (/^\/api\//.test(req.url)) return next();

		if (req.user && req.user.uid) {
			user.session_ping(req.sessionID, req.user.uid);
		}

		// (Re-)register the session as active
		user.active.register(req.sessionID);

		next();
	});
	
	auth.create_routes(app);
	admin.create_routes(app);
	userRoute.create_routes(app);
	installRoute.create_routes(app);
	testBed.create_routes(app);

	app.create_route = function(url, tpl) { // to remove
		return '<script>templates.ready(function(){ajaxify.go("' + url + '", null, "' + tpl + '");});</script>';
	};

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
					
					res.send(app.build_header(res) + app.create_route(route) + templates['footer']);
				});
			}(routes[i]));
		}
	}());
	
	// Complex Routes
	app.get('/', function(req, res) {
		categories.getAllCategories(function(returnData) {
			res.send(
				app.build_header(res) +
				'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/home'].parse(returnData) + '\n\t</noscript>' +
				app.create_route('') +
				templates['footer']
			);
		}, 0);
	});

	app.get('/topic/:topic_id/:slug?', function(req, res) {
		var tid = req.params.topic_id;
		if (tid.match('.rss')) {
			fs.readFile('feeds/topics/' + tid, function (err, data) {
				if (err) {
					res.type('text').send(404, "Unable to locate an rss feed at this location.");
					return;
				}
				
				res.type('xml').set('Content-Length', data.length).send(data);
			});
			return;
		}


		var topic_url = tid + (req.params.slug ? '/' + req.params.slug : '');
		topics.getTopicWithPosts(tid, ((req.user) ? req.user.uid : 0), function(err, topic) {
			if (err) return res.redirect('404');

			res.send(
				app.build_header(res) +
				'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/topic'].parse(topic) + '\n\t</noscript>' +
				'\n\t<script>templates.ready(function(){ajaxify.go("topic/' + topic_url + '");});</script>' +
				templates['footer']
			);
		});
	});

	app.get('/category/:category_id/:slug?', function(req, res) {
		var cid = req.params.category_id;
		if (cid.match('.rss')) {
			fs.readFile('feeds/categories/' + cid, function (err, data) {
				if (err) {
					res.type('text').send(404, "Unable to locate an rss feed at this location.");
					return;
				}

				res.type('xml').set('Content-Length', data.length).send(data);
			});
			return;
		}

		var category_url = cid + (req.params.slug ? '/' + req.params.slug : '');
		categories.getCategoryById(cid, 0, function(returnData) {
			res.send(
				app.build_header(res) +
				'\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/category'].parse(returnData) + '\n\t</noscript>' +
				'\n\t<script>templates.ready(function(){ajaxify.go("category/' + category_url + '");});</script>' +
				templates['footer']
			);
		});
	});

	app.get('/confirm/:code', function(req, res) {
		res.send(app.build_header(res) + '<script>templates.ready(function(){ajaxify.go("confirm/' + req.params.code + '");});</script>' + templates['footer']);
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
						data.motd_class = (config.show_motd === '1' || config.show_motd === undefined) ? '' : 'none';
						data.motd = marked(config.motd || "# NodeBB v0.1\nWelcome to NodeBB, the discussion platform of the future.\n\n<a target=\"_blank\" href=\"http://www.nodebb.org\" class=\"btn btn-large\"><i class=\"icon-comment\"></i> Get NodeBB</a> <a target=\"_blank\" href=\"https://github.com/designcreateplay/NodeBB\" class=\"btn btn-large\"><i class=\"icon-github-alt\"></i> Fork us on Github</a> <a target=\"_blank\" href=\"https://twitter.com/dcplabs\" class=\"btn btn-large\"><i class=\"icon-twitter\"></i> @dcplabs</a>");
						res.json(data);
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
					categories.getCategoryById(req.params.id, uid, function(data) {
						res.json(data);
					}, req.params.id, uid);
				break;
			case 'recent' :
					categories.getLatestTopics(uid, 0, 9, function(data) {
						res.json(data);
					});
				break;
			case 'popular' :
					categories.getLatestTopics(uid, 0, 9, function(data) {
						res.json(data);
					});
				break;
			case 'active' :
					categories.getLatestTopics(uid, 0, 9, function(data) {
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
			default :
				res.json(404, { error: 'unrecognized API endpoint' });
			break;
		}
	}

	app.get('/api/:method', api_method);
	app.get('/api/:method/:id', api_method);
	// ok fine MUST ADD RECURSION style. I'll look for a better fix in future but unblocking baris for this:
	app.get('/api/:method/:id/:section?', api_method);
	app.get('/api/:method/:id*', api_method);

	app.get('/cid/:cid', function(req, res) {
		categories.getCategoryData(req.params.cid, function(data){
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


	app.get('/test', function(req, res) {
		
		console.log('derp');
		user.get_userslugs_by_uids([1,2], function(data) {
			res.send(data);
		});
		
/*		categories.getCategoryById(1,1, function(data) {
			res.send(data);
		},1);*/ 
		
	});


	//START TODO: MOVE TO GRAPH.JS 

	app.get('/graph/users/:username/picture', function(req, res) {
		user.get_uid_by_username(req.params.username, function(uid) {
			if (uid == null) {
				res.json({
					status: 0
				});
				return;
			}
			user.getUserField(uid, 'picture', function(picture) {
				if (picture == null) res.redirect('http://www.gravatar.com/avatar/a938b82215dfc96c4cabeb6906e5f953&default=identicon');
				res.redirect(picture);
			});
		});
		
	});

	//END TODO: MOVE TO GRAPH.JS
}(WebServer));

server.listen(config.port);
global.server = server;
