'use strict';

var winston = require('winston');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
var less = require('less');
var async = require('async');
var uglify = require('uglify-js');
var nconf = require('nconf');
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
	'public/vendor/xregexp/xregexp.js',
	'public/vendor/xregexp/unicode/unicode-base.js',
	'public/src/utils.js',
	'public/src/installer/install.js',
];

web.install = function (port) {
	port = port || 4567;
	winston.info('Launching web installer on port', port);

	app.use(express.static('public', {}));
	app.engine('tpl', require('templates.js').__express);
	app.set('view engine', 'tpl');
	app.set('views', path.join(__dirname, '../src/views'));
	app.use(bodyParser.urlencoded({
		extended: true,
	}));

	async.parallel([compileLess, compileJS], function (err) {
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
	var databases = dbs.map(function (el) {
		return {
			name: el,
			questions: require('../src/database/' + el).questions,
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

	var child = require('child_process').spawn('node', ['loader.js'], {
		detached: true,
		stdio: ['ignore', 'ignore', 'ignore'],
	});

	process.stdout.write('\nStarting NodeBB\n');
	process.stdout.write('    "./nodebb stop" to stop the NodeBB server\n');
	process.stdout.write('    "./nodebb log" to view server output\n');
	process.stdout.write('    "./nodebb restart" to restart NodeBB\n');

	async.parallel([
		function (next) {
			fs.unlink(path.join(__dirname, '../public/installer.css'), next);
		},
		function (next) {
			fs.unlink(path.join(__dirname, '../public/installer.min.js'), next);
		},
	], function (err) {
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

module.exports = web;
