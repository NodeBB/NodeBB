var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
    connect = require('connect'),
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

	function hasAuth(req, res, next) {
		// Include this middleware if the endpoint is publically accessible, but has elements that logged in users can see
		global.modules.user.get_uid_by_session(req.sessionID, function(uid) {
			if (uid) {
				global.uid = uid;
				console.log('info: [Auth] User is logged in as uid: ' + uid);
			} else {
				console.log('info: [Auth] User is not logged in');
			}

			next();
		});
	}

	function requireAuth(req, res, next) {
		// Include this middleware if the endpoint requires a logged in user to view
		hasAuth(req, res, function() {
			if (!global.uid) {
				res.redirect('/403');
			} else {
				console.log('info: [Auth] User is logged in as uid: ' + uid);
				next();
			}
		});
	}

	// Middlewares
	app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.session({secret: 'nodebb', key: 'express.sid'}));
	// Dunno wtf this does
	//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
	// Useful if you want to use app.put and app.delete (instead of app.post all the time)
	//	app.use(express.methodOverride());

	app.get('/', hasAuth, function(req, res) {
		global.modules.topics.generate_forum_body(function(forum_body) {
			res.send(templates['header'] + forum_body + templates['footer']);	
		})
		
		//res.send(templates['header'] + templates['home'] + templates['footer']);
	});

	app.get('/login', hasAuth, function(req, res) {
		res.send(templates['header'] + templates['login'] + templates['footer']);
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
		res.send(403, 'You are not authorized to view this page');
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