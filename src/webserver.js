var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
    config = require('../config.js'),
    redis = require('redis'),
	redisServer = redis.createClient(config.redis.port, config.redis.host, config.redis.options),
	passport = require('passport'),
	passportLocal = require('passport-local').Strategy;

passport.use(new passportLocal(function(user, password, next) {
	global.modules.user.loginViaLocal(user, password, function(login) {
		if (login.status === 'ok') next(null, login.user);
		else next(null, false, login);
	});
}));

passport.serializeUser(function(user, done) {
	done(null, user.uid);
});

passport.deserializeUser(function(uid, done) {
	done(null, {
		uid: uid
	});
});

(function(app) {
	var templates = global.templates;

	function refreshTemplates() {
		//need a better solution than copying this code on every call. is there an "onconnect" event?
		if (DEVELOPMENT === true) {
			// refreshing templates
			modules.templates.init();
		}
	}

	// Middlewares
	app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
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
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(function(req, res, next) {
		// Don't bother with session handling for API requests
		if (/^\/api\//.test(req.url)) return next();

		if (req.user && req.user.uid) {
			global.modules.user.session_ping(req.sessionID, req.user.uid);
		}

		// if (req.session.uid === undefined) {
		// 	console.log('info: [Auth] First load, retrieving uid...');
			
		// 	global.modules.user.get_uid_by_session(req.sessionID, function(uid) {
		// 		if (uid !== null) {
		// 			req.session.uid = uid;
		// 			console.log('info: [Auth] uid ' + req.session.uid + ' found. Welcome back.');
		// 		} else {
		// 			req.session.uid = 0;
		// 			console.log('info: [Auth] No login session found.');
		// 		}
		// 	});
		// } else {
		// 	// console.log('SESSION: ' + req.sessionID);
		// 	// console.log('info: [Auth] Ping from uid ' + req.session.uid);
		// }

		// (Re-)register the session as active
		global.modules.user.active.register(req.sessionID);

		next();
	});
	// Dunno wtf this does
	//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
	// Useful if you want to use app.put and app.delete (instead of app.post all the time)
	//	app.use(express.methodOverride());


	// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
	(function() {
		var routes = ['', 'login', 'register'];

		for (var i=0, ii=routes.length; i<ii; i++) {
			(function(route) {
				app.get('/' + route, function(req, res) {
					res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("' + route + '");});</script>' + templates['footer']);
				});
			}(routes[i]));
		}
	}());
	

	function generate_topic_body(req, res) {
		global.modules.topics.generate_topic_body(function(topic_body) {
			res.send(templates['header'] + topic_body + templates['footer']);
		}, req.params.topic_id);
	}
	app.get('/topic/:topic_id', generate_topic_body);
	app.get('/topic/:topic_id*', generate_topic_body);



	function api_method(req, res) {
		switch(req.params.method) {
			case 'home' :
					global.modules.topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'topic' :
					global.modules.posts.get(function(data) {
						res.send(JSON.stringify(data));
					}, req.params.id);
				break;
			default :
				res.send('{}');
			break;
		}
	}
	app.get('/api/:method', api_method);
	app.get('/api/:method/:id', api_method);
	app.get('/api/:method/:id*', api_method);

	app.post('/login', passport.authenticate('local', {
		successRedirect: '/',
		failureRedirect: '/login'
	}));

	app.get('/logout', function(req, res) {
		console.log('info: [Auth] Session ' + res.sessionID + ' logout (uid: ' + global.uid + ')');
		global.modules.user.logout(req.sessionID, function(logout) {
			req.logout();
			res.send(templates['header'] + templates['logout'] + templates['footer']);
		});
	});

	app.get('/reset/:code', function(req, res) {
		res.send(templates['header'] + templates['reset_code'].parse({ reset_code: req.params.code }) + templates['footer']);
	});

	app.get('/reset', function(req, res) {
		res.send(templates['header'] + templates['reset'] + templates['footer']);
	});

	app.get('/403', function(req, res) {
		res.send(templates['header'] + templates['403'] + templates['footer']);
	});
}(WebServer));

server.listen(config.port);
global.server = server;