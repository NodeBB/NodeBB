'use strict';

var winston = require('winston');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var less = require('less');
var async = require('async');
var uglify = require('uglify-es');
var nconf = require('nconf');
var Benchpress = require('benchpressjs');

var app = express();
var server;

var formats = [
	winston.format.colorize(),
];

const timestampFormat = winston.format((info) => {
	var dateString = new Date().toISOString() + ' [' + global.process.pid + ']';
	info.level = dateString + ' - ' + info.level;
	return info;
});
formats.push(timestampFormat());
formats.push(winston.format.splat());
formats.push(winston.format.simple());

winston.configure({
	level: 'verbose',
	format: winston.format.combine.apply(null, formats),
	transports: [
		new winston.transports.Console({
			handleExceptions: true,
		}),
		new winston.transports.File({
			filename: 'logs/webinstall.log',
			handleExceptions: true,
		}),
	],
});

var web = module.exports;

var scripts = [
	'node_modules/jquery/dist/jquery.js',
	'public/vendor/xregexp/xregexp.js',
	'public/vendor/xregexp/unicode/unicode-base.js',
	'public/src/utils.js',
	'public/src/installer/install.js',
];

var installing = false;
var success = false;
var error = false;
var launchUrl;

web.install = function (port) {
	port = port || 4567;
	winston.info('Launching web installer on port ' + port);

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

	async.parallel([compileLess, compileJS, copyCSS, loadDefaults], function (err) {
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
	app.get('/ping', ping);
	app.get('/sping', ping);
}

function ping(req, res) {
	res.status(200).send(req.path === '/sping' ? 'healthy' : '200');
}

function welcome(req, res) {
	var dbs = ['redis', 'mongo', 'postgres'];
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
		url: nconf.get('url') || (req.protocol + '://' + req.get('host')),
		launchUrl: launchUrl,
		skipGeneralSetup: !!nconf.get('url'),
		databases: databases,
		skipDatabaseSetup: !!nconf.get('database'),
		error: error,
		success: success,
		values: req.body,
		minimumPasswordLength: defaults.minimumPasswordLength,
		installing: installing,
	});
}

function install(req, res) {
	if (installing) {
		return welcome(req, res);
	}
	req.setTimeout(0);
	installing = true;
	var setupEnvVars = nconf.get();
	for (var i in req.body) {
		if (req.body.hasOwnProperty(i) && !process.env.hasOwnProperty(i)) {
			setupEnvVars[i.replace(':', '__')] = req.body[i];
		}
	}

	// Flatten any objects in setupEnvVars
	const pushToRoot = function (parentKey, key) {
		setupEnvVars[parentKey + '__' + key] = setupEnvVars[parentKey][key];
	};
	for (var j in setupEnvVars) {
		if (setupEnvVars.hasOwnProperty(j) && typeof setupEnvVars[j] === 'object' && setupEnvVars[j] !== null && !Array.isArray(setupEnvVars[j])) {
			Object.keys(setupEnvVars[j]).forEach(pushToRoot.bind(null, j));
			delete setupEnvVars[j];
		} else if (Array.isArray(setupEnvVars[j])) {
			setupEnvVars[j] = JSON.stringify(setupEnvVars[j]);
		}
	}

	winston.info('Starting setup process');
	winston.info(setupEnvVars);
	launchUrl = setupEnvVars.url;

	var child = require('child_process').fork('app', ['--setup'], {
		env: setupEnvVars,
	});

	child.on('close', function (data) {
		installing = false;
		success = data === 0;
		error = data !== 0;

		welcome(req, res);
	});
}

function launch(req, res) {
	res.json({});
	server.close();

	var child;

	if (!nconf.get('launchCmd')) {
		child = childProcess.spawn('node', ['loader.js'], {
			detached: true,
			stdio: ['ignore', 'ignore', 'ignore'],
		});

		console.log('\nStarting NodeBB');
		console.log('    "./nodebb stop" to stop the NodeBB server');
		console.log('    "./nodebb log" to view server output');
		console.log('    "./nodebb restart" to restart NodeBB');
	} else {
		// Use launchCmd instead, if specified
		child = childProcess.exec(nconf.get('launchCmd'), {
			detached: true,
			stdio: ['ignore', 'ignore', 'ignore'],
		});
	}

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

function loadDefaults(next) {
	var setupDefaultsPath = path.join(__dirname, '../setup.json');
	fs.access(setupDefaultsPath, fs.constants.F_OK | fs.constants.R_OK, function (err) {
		if (err) {
			// setup.json not found or inaccessible, proceed with no defaults
			return setImmediate(next);
		}

		winston.info('[installer] Found setup.json, populating default values');
		nconf.file({
			file: setupDefaultsPath,
		});

		next();
	});
}
