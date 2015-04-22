"use strict";

var winston = require('winston'),
	express = require('express'),
	bodyParser = require('body-parser'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	async = require('async'),
	uglify = require('uglify-js'),
	app = express();

var web = {},
	scripts = [
		'public/vendor/jquery/js/jquery.js',
		'public/vendor/bootstrap/js/bootstrap.min.js',
		'public/vendor/bootbox/bootbox.min.js',
		'public/vendor/xregexp/xregexp.js',
		'public/vendor/xregexp/unicode/unicode-base.js',
		'public/src/utils.js',
		'public/src/installer/install.js'
	];

web.install = function(port) {
	port = port || 8080;
	winston.info('Launching web installer on port ', port);

	app.use(express.static('public', {}));
	app.engine('tpl', require('templates.js').__express);
	app.set('view engine', 'tpl');
	app.set('views', path.join(__dirname, '../src/views'));
	app.use(bodyParser.urlencoded({
		extended: true
	})); 

	async.parallel([compileLess, compileJS], function() {
		setupRoutes();
		launchExpress(port);
	});
};


function launchExpress(port) {
	var server = app.listen(port, function() {
		var host = server.address().address;
		winston.info('Web installer listening on http://%s:%s', host, port);
	});
}

function setupRoutes() {
	app.get('/', welcome);
	app.post('/', install);
}

function welcome(req, res) {
	var dbs = ['redis', 'mongo'],
		databases = [];

	dbs.forEach(function(el) {
		databases.push({
			name: el,
			questions: require('../src/database/' + el).questions
		});
	});

	res.render('install/index', {
		databases: databases
	});
}

function install(req, res) {
	req.body.url = "http://127.0.0.1";
	req.body.port = "4567";
	var parameters = JSON.stringify(req.body).replace(/"/g, '\\"');


	var sys = require('sys'),
		exec = require('child_process').exec,
		command = 'node app.js --setup=\'' + parameters + '\'';

	exec(command, function(error, stdout, stderr) {
		res.json(error, stdout, stderr);
	});
}

function compileLess(callback) {
	fs.readFile(path.join(__dirname, '../public/less/install.less'), function(err, style) {
		less.render(style.toString(), function(err, css) {
			if(err) {
				return winston.error('Unable to compile LESS: ', err);
			}

			fs.writeFile(path.join(__dirname, '../public/stylesheet.css'), css.css, callback);
		});
	});
}

function compileJS(callback) {
	var scriptPath = path.join(__dirname, '..'),
		result = uglify.minify(scripts.map(function(script) {
			return path.join(scriptPath, script);
		}));


	fs.writeFile(path.join(__dirname, '../public/nodebb.min.js'), result.code, callback);
}

module.exports = web;