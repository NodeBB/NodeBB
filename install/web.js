"use strict";

var winston = require('winston'),
	express = require('express'),
	nconf = require('nconf'),
	path = require('path'),
	app = express();

var web = {};

web.install = function(port) {
	port = port || 8080;
	winston.info('Launching web installer on port ', port);

	setupRoutes();
	launchExpress(port);
};


function launchExpress(port) {
	app.use(express.static('public', {}));
	app.engine('tpl', require('templates.js').__express);
	app.set('view engine', 'tpl');
	app.set('views', path.join(__dirname, '../src/views'));

	var server = app.listen(port, function() {
		var host = server.address().address;
		winston.info('Web installer listening on http://%s:%s', host, port);
	});
}

function setupRoutes() {
	app.get('/', install);
}

function install(req, res, next) {
	console.log('test');
	res.render('install/index', {});
}


module.exports = web;