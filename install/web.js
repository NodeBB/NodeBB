"use strict";

var winston = require('winston'),
	express = require('express'),
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

	async.parallel([compileLess, compileJS], function() {
		setupRoutes();
		launchExpress(port);
	});
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
	res.render('install/index', {});
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