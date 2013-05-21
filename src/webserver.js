var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
    config = require('../config.js'),
    redis = require('redis'),
	redisServer = redis.createClient(config.redis.port, config.redis.host, config.redis.options),
	
	user = require('./user.js'),

	categories = require('./categories.js'),
	posts = require('./posts.js'),
	topics = require('./topics.js'),
	utils = require('./utils.js'),
	fs = require('fs'),
	admin = require('./routes/admin.js'),
	userRoute = require('./routes/user.js'),
	auth = require('./routes/authentication.js');


(function(app) {
	var templates = null;

	// Middlewares
	app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
	app.use(require('less-middleware')({ src: path.join(__dirname, '../', '/public') }));
	app.use(express.static(path.join(__dirname, '../', 'public')));
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.compress());
	app.use(express.session({
		store: new RedisStore({
			client: redisServer,
			ttl: 60*60*24*14
		}),
		secret: config.secret,
		key: 'express.sid'
	}));


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


	app.create_route = function(url, tpl) { // to remove
		return '<script>templates.ready(function(){ajaxify.go("' + url + '", null, "' + tpl + '");});</script>';
	};


	// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
	(function() {
		var routes = ['', 'login', 'register', 'account', 'latest', 'popular', 'active', '403'];

		for (var i=0, ii=routes.length; i<ii; i++) {
			(function(route) {
				
				app.get('/' + route, function(req, res) {
					
					if ((route === 'login' || route ==='register') && (req.user && req.user.uid > 0)) {
						res.redirect('/account');
						return;
					}
					
					res.send(templates['header'] + app.create_route(route) + templates['footer']);
				});
			}(routes[i]));
		}
	}());
	
	// Complex Routes
	app.get('/topic/:topic_id/:slug?', function(req, res) {
		var topic_url = req.params.topic_id + (req.params.slug ? '/' + req.params.slug : '');
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("topic/' + topic_url + '");});</script>' + templates['footer']);
	});

	app.get('/category/:category_id/:slug?', function(req, res) {
		var category_url = req.params.category_id + (req.params.slug ? '/' + req.params.slug : '');
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("category/' + category_url + '");});</script>' + templates['footer']);
	});

	app.get('/confirm/:code', function(req, res) {
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("confirm/' + req.params.code + '");});</script>' + templates['footer']);
	});
	
	// These functions are called via ajax once the initial page is loaded to populate templates with data
	function api_method(req, res) {		
		
		switch(req.params.method) {
			case 'get_templates_listing' :
					utils.walk(global.configuration.ROOT_DIRECTORY + '/public/templates', function(err, data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'home' :
					categories.get(function(data) {
						res.send(JSON.stringify(data));
					});
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

					res.send(JSON.stringify(data));
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

					res.send(JSON.stringify(data));
				break;
			case 'topic' :
					posts.get(function(data) {
						if(!data) {
							res.send(false);
							return;
						}
						res.send(JSON.stringify(data));
					}, req.params.id, (req.user) ? req.user.uid : 0);
				break;
			case 'category' :
					topics.get(function(data) {
						if(!data) {
							res.send(false);
							return;
						}
						res.send(JSON.stringify(data));
					}, req.params.id, (req.user) ? req.user.uid : 0);
				break;
			case 'latest' :
					topics.get(function(data) {
						if(!data) {
							res.send(false);
							return;
						}
						res.send(JSON.stringify(data));
					});
				break;
			case 'popular' :
					topics.get(function(data) {
						if(!data) {
							res.send(false);
							return;
						}
						res.send(JSON.stringify(data));
					});
				break;
			case 'active' :
					topics.get(function(data) {
						if(!data) {
							res.send(false);
							return;
						}
						res.send(JSON.stringify(data));
					});
				break;
			case 'confirm':
					user.email.confirm(req.params.id, function(data) {
						if (data.status === 'ok') {
							res.send(JSON.stringify({
								'alert-class': 'alert-success',
								title: 'Email Confirmed',
								text: 'Thank you for vaidating your email. Your account is now fully activated.'
							}));
						} else {
							res.send(JSON.stringify({
								'alert-class': 'alert-error',
								title: 'An error occurred...',
								text: 'There was a problem validating your email address. Perhaps the code was invalid or has expired.'
							}));
						}
					});
				break;
			default :
				res.send('{}');
			break;
		}
	}

	app.get('/api/:method', api_method);
	app.get('/api/:method/:id', api_method);
	// ok fine MUST ADD RECURSION style. I'll look for a better fix in future but unblocking baris for this:
	app.get('/api/:method/:id/:section?', api_method);
	app.get('/api/:method/:id*', api_method);

	app.get('/test', function(req, res) {
		topics.get_latest_undeleted_pid(5, function(pid) {
			res.send(pid);
		});
	});


	//START TODO: MOVE TO GRAPH.JS 

	app.get('/graph/users/:username/picture', function(req, res) {
		user.get_uid_by_username(req.params.username, function(uid) {
			if (uid == null) {
				res.send('{status:0}');
				return;
			}
			user.getUserField(uid, 'picture', function(picture) {
				if (picture == null) res.redirect('http://www.gravatar.com/avatar/a938b82215dfc96c4cabeb6906e5f953');
				res.redirect(picture);
			});
		});
		
	});

	//END TODO: MOVE TO GRAPH.JS
}(WebServer));

server.listen(config.port);
global.server = server;