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
	app.get('/', function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['home'] + templates['footer']);
	});

	app.get('/login', function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['login'] + templates['footer']);
	});

	app.get('/reset/:code', function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['reset_code'].parse({ reset_code: req.params.code }) + templates['footer']);
	});

	app.get('/reset', function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['reset'] + templates['footer']);
	});

	app.get('/register', function(req, res) {
		refreshTemplates();
		res.send(templates['header'] + templates['register'] + templates['footer']);
	});

	module.exports.init = function() {
		// todo move some of this stuff into config.json
		app.configure(function() {
			app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
			app.use(express.bodyParser());	// Puts POST vars in request.body
			app.use(express.cookieParser());	// Presumably important
			
			// Dunno wtf this does
			// app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
			
			// Useful if you want to use app.put and app.delete (instead of app.post all the time)
			// app.use(express.methodOverride());
			app.use(express.static(global.configuration.ROOT_DIRECTORY + '/public')); 
		});
	}

}(WebServer));

server.listen(config.port);
global.server = server;