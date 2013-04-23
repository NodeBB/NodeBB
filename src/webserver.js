var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
    connect = require('connect'),
    config = require('../config.js');

(function(app) {
	var templates = global.templates;

	app.get('/', function(req, res) {
		res.send(templates['header'] + templates['home'] + templates['footer']);
	});

	app.get('/login', function(req, res) {
		res.send(templates['header'] + templates['login'] + templates['footer']);
	});

	app.get('/reset', function(req, res) {
		res.send(templates['header'] + templates['reset'] + templates['footer']);
	});

	app.get('/register', function(req, res) {
		res.send(templates['header'] + templates['register'] + templates['footer']);
	});

	module.exports.init = function() {
		// todo move some of this stuff into config.json
		app.configure(function() {
			app.use(express.favicon());
			app.use(express.bodyParser());
			app.use(express.cookieParser());
			// app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
			// app.use(express.methodOverride());
			app.use(express.static(global.configuration.ROOT_DIRECTORY + '/public')); 
		});
	}

}(WebServer));

server.listen(config.port);
global.server = server;