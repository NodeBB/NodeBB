'use strict';

var winston = require('winston');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var less = require('less');
var async = require('async');
var uglify = require('uglify-js');
var nconf = require('nconf');
var Benchpress = require('benchpressjs');

var app = express();
var server;

winston.add(winston.transports.File, {
	filename: 'logs/webinstall.log',
	colorize: true,
	timestamp: function () {
		var date = new Date();
		return date.getDate() + '/' + (date.getMonth() + 1) + ' ' + date.toTimeString().substr(0, 5) + ' [' + global.process.pid + ']';
	},
	level: 'verbose',
});

var web = {};
var scripts = [
	'node_modules/jquery/dist/jquery.js',
	'public/vendor/xregexp/xregexp.js',
	'public/vendor/xregexp/unicode/unicode-base.js',
	'public/src/utils.js',
	'public/src/installer/install.js',
];

web.install = function (port) {
	port = port || 4567;
	winston.info('Launching web installer on port', port);

	app.use(express.static('public', {}));
	app.engine('tpl', function (filepath, options, callback) {
		async.waterfall([
			function (next) {
				fs.readFile(filepath, 'utf-8', next);
			},
			function (buffer, next) {
				Benchpress.compileParse(buffer.toString(), options, next);
			},
		], callback);
	});
	app.set('view engine', 'tpl');
	app.set('views', path.join(__dirname, '../src/views'));
	app.use(bodyParser.urlencoded({
		extended: true,
	}));

	async.parallel([compileLess, compileJS, copyCSS], function (err) {
		if (err) {
			winston.error(err);
		}
		setupRoutes();
		launchExpress(port);
	});
};


function launchExpress(port) {
	server = app.listen(port, function () {
		winston.info('Web installer listening on http://%s:%s', '0.0.0.0', port);
	});
}

function setupRoutes() {
	app.get('/', welcome);
	app.post('/', install);
	app.post('/launch', launch);
}

function welcome(req, res) {
	var dbs = ['redis', 'mongo'];
	var databases = dbs.map(function (databaseName) {
		var questions = require('../src/database/' + databaseName).questions.filter(function (question) {
			return question && !question.hideOnWebInstall;
		});

		return {
			name: databaseName,
			questions: questions,
		};
	});

	var defaults = require('./data/defaults');

	res.render('install/index', {
		databases: databases,
		skipDatabaseSetup: !!nconf.get('database'),
		error: !!res.locals.error,
		success: !!res.locals.success,
		values: req.body,
		minimumPasswordLength: defaults.minimumPasswordLength,
	});
}

function install(req, res) {
	for (var i in req.body) {
		if (req.body.hasOwnProperty(i) && !process.env.hasOwnProperty(i)) {
			process.env[i.replace(':', '__')] = req.body[i];
		}
	}

	var child = require('child_process').fork('app', ['--setup'], {
		env: process.env,
	});

	child.on('close', function (data) {
		if (data === 0) {
			res.locals.success = true;
		} else {
			res.locals.error = true;
		}

		welcome(req, res);
	});
}

function launch(req, res) {
	res.json({});
	server.close();

	var child = childProcess.spawn('node', ['loader.js'], {
		detached: true,
		stdio: ['ignore', 'ignore', 'ignore'],
	});

	console.log('\nStarting NodeBB');
	console.log('    "./nodebb stop" to stop the NodeBB server');
	console.log('    "./nodebb log" to view server output');
	console.log('    "./nodebb restart" to restart NodeBB');

	var filesToDelete = [
		'installer.css',
		'installer.min.js',
		'bootstrap.min.css',
	];

	async.each(filesToDelete, function (filename, next) {
		fs.unlink(path.join(__dirname, '../public', filename), next);
	}, function (err) {
		if (err) {
			winston.warn('Unable to remove installer files');
		}

		child.unref();
		process.exit(0);
	});
}

function compileLess(callback) {
	fs.readFile(path.join(__dirname, '../public/less/install.less'), function (err, style) {
		if (err) {
			return winston.error('Unable to read LESS install file: ', err);
		}

		less.render(style.toString(), function (err, css) {
			if (err) {
				return winston.error('Unable to compile LESS: ', err);
			}

			fs.writeFile(path.join(__dirname, '../public/installer.css'), css.css, callback);
		});
	});
}

function compileJS(callback) {
	var code = '';
	async.eachSeries(scripts, function (srcPath, next) {
		fs.readFile(path.join(__dirname, '..', srcPath), function (err, buffer) {
			if (err) {
				return next(err);
			}

			code += buffer.toString();
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}
		try {
			var minified = uglify.minify(code, {
				compress: false,
			});
			if (!minified.code) {
				return callback(new Error('[[error:failed-to-minify]]'));
			}
			fs.writeFile(path.join(__dirname, '../public/installer.min.js'), minified.code, callback);
		} catch (e) {
			callback(e);
		}
	});
}

function copyCSS(next) {
	async.waterfall([
		function (next) {
			fs.readFile(path.join(__dirname, '../node_modules/bootstrap/dist/css/bootstrap.min.css'), 'utf8', next);
		},
		function (src, next) {
			fs.writeFile(path.join(__dirname, '../public/bootstrap.min.css'), src, next);
		},
	], next);
}

module.exports = web;
