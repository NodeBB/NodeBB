var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
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

	// Middlewares
	app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
	app.use(express.static(path.join(__dirname, '../', 'public')));
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.compress());
	app.use(express.session({
		store: new RedisStore({
			ttl: 60*60*24*14
		}),
		secret: 'nodebb',
		key: 'express.sid'
	}));
	app.use(function(req, res, next) {
		// Don't bother with session handling for API requests
		if (/^\/api\//.test(req.url)) return next();

		if (req.session.uid === undefined) {
			console.log('info: [Auth] First load, retrieving uid...');
			global.modules.user.get_uid_by_session(req.sessionID, function(uid) {
				if (uid !== null) {
					req.session.uid = uid;
					console.log('info: [Auth] uid ' + req.session.uid + ' found. Welcome back.');
				} else {
					req.session.uid = 0;
					console.log('info: [Auth] No login session found.');
				}
			});
		} else {
			// console.log('SESSION: ' + req.sessionID);
			// console.log('info: [Auth] Ping from uid ' + req.session.uid);
		}

		// (Re-)register the session as active
		global.modules.user.active.register(req.sessionID);

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


	// need a proper way to combine these two routes together
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
			break;
		}
	});

	app.get('/login', function(req, res) {
		res.send(templates['header'] + templates['login'] + templates['footer']);
	});

	app.get('/logout', function(req, res) {
		console.log('info: [Auth] Session ' + res.sessionID + ' logout (uid: ' + global.uid + ')');
		global.modules.user.logout(req.sessionID, function(logout) {
			if (logout === true) {
				delete(req.session.uid);
				req.session.destroy();
			}
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

	app.get('/account', function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['account_settings'] + templates['footer']);
	});

	app.get('/403', function(req, res) {
		res.send(templates['header'] + templates['403'] + templates['footer']);
	});
}(WebServer));

server.listen(config.port);
global.server = server;