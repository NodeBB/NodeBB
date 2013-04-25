var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express);
    config = require('../config.js');

(function(app) {
	var templates = global.templates;

	function refreshTemplates() {
		//need a better solution than copying this code on every call. is there an "onconnect" event?
		if (DEVELOPMENT === true) {
			// refreshing templates
			modules.templates.init();
		}
	}

	function requireAuth(req, res, next) {
		// Include this middleware if the endpoint requires a logged in user to view
		if (!global.uid) {
			res.redirect('/403');
		} else {
			next();
		}
	}

	// Middlewares
	app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.session({
		store: new RedisStore({
			ttl: 60*60*24*14
		}),
		secret: 'nodebb',
		key: 'express.sid'
	}));
	app.use(function(req, res, next) {
		if (global.uid === undefined) {
			console.log('info: [Auth] First load, retrieving uid...');
			global.modules.user.get_uid_by_session(req.sessionID, function(uid) {
				global.uid = uid;
				if (global.uid !== null) console.log('info: [Auth] uid ' + global.uid + ' found. Welcome back.');
				else console.log('info: [Auth] No login session found.');
			});
		} else {
			console.log('info: [Auth] Ping from uid ' + global.uid);
		}

		next();
	});
	// Dunno wtf this does
	//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
	// Useful if you want to use app.put and app.delete (instead of app.post all the time)
	//	app.use(express.methodOverride());

	app.get('/', function(req, res) {
		global.modules.topics.generate_forum_body(function(forum_body) {
			res.send(templates['header'] + forum_body + templates['footer']);	
		});
	});



	app.get('/topics/:topic_id', function(req, res) {
		global.modules.topics.generate_topic_body(function(topic_body) {
			res.send(templates['header'] + topic_body + templates['footer']);
		}, req.params.topic_id)
	});
	app.get('/topics/:topic_id/:slug', function(req, res) {
		global.modules.topics.generate_topic_body(function(topic_body) {
			res.send(templates['header'] + topic_body + templates['footer']);
		}, req.params.topic_id)
	});

	app.get('/api/:method', function(req, res) {
		switch(req.params.method) {
			case 'home' :
					global.modules.topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			default :
				res.send('{}');
		}
	});

	app.get('/login', function(req, res) {
		res.send(templates['header'] + templates['login'] + templates['footer']);
	});

	app.get('/logout', function(req, res) {
		console.log('info: [Auth] Session ' + res.sessionID + ' logout (uid: ' + global.uid + ')');
		global.modules.user.logout(function(logout) {
			if (logout === true) req.session.destroy();
		});

		res.send(templates['header'] + templates['logout'] + templates['footer']);
	});

	app.get('/reset/:code', function(req, res) {
		res.send(templates['header'] + templates['reset_code'].parse({ reset_code: req.params.code }) + templates['footer']);
	});

	app.get('/reset', function(req, res) {
		res.send(templates['header'] + templates['reset'] + templates['footer']);
	});

	app.get('/register', function(req, res) {
		res.send(templates['header'] + templates['register'] + templates['footer']);
	});

	app.get('/account', requireAuth, function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['account_settings'] + templates['footer']);
	});

	app.get('/403', function(req, res) {
		res.send(templates['header'] + templates['403'] + templates['footer']);
	});

	module.exports.init = function() {
		// todo move some of this stuff into config.json
		app.configure(function() {
			app.use(express.static(global.configuration.ROOT_DIRECTORY + '/public')); 
		});
	}
}(WebServer));

server.listen(config.port);
global.server = server;