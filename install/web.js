"use strict";

var winston = require('winston'),
	express = require('express'),
	bodyParser = require('body-parser'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	async = require('async'),
	uglify = require('uglify-js'),
	nconf = require('nconf'),
	app = express(),
	server;

var web = {},
	scripts = [
		'public/vendor/xregexp/xregexp.js',
		'public/vendor/xregexp/unicode/unicode-base.js',
		'public/src/utils.js',
		'public/src/installer/install.js'
	];

web.install = function(port) {
	port = port || 4567;
	winston.info('Launching web installer on port', port);

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
	server = app.listen(port, function() {
		winston.info('Web installer listening on http://%s:%s', '0.0.0.0', port);
	});
}

function setupRoutes() {
	app.get('/', welcome);
	app.post('/', install);
	app.post('/launch', launch);
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
		databases: databases,
		skipDatabaseSetup: !!nconf.get('database'),
		error: res.locals.error ? true : false,
		success: res.locals.success ? true : false,
		values: req.body
	});
}

function install(req, res) {
	for (var i in req.body) {
		if (req.body.hasOwnProperty(i) && !process.env.hasOwnProperty(i)) {
			process.env[i.replace(':', '__')] = req.body[i];
		}
	}

	var child = require('child_process').fork('app', ['--setup'], {
		env: process.env
	});

	child.on('close', function(data) {
		if (data === 0) {
			res.locals.success = true;
		} else {
			res.locals.error = true;
		}

		welcome(req, res);
	});
}

function launch(req, res) {
	var pidFilePath = __dirname + '../pidfile';
	res.json({});
	server.close();

	var child = require('child_process').spawn('node', ['loader.js'], {
		detached: true,
		stdio: ['ignore', 'ignore', 'ignore']
	});

	process.stdout.write('\nStarting NodeBB\n');
	process.stdout.write('    "./nodebb stop" to stop the NodeBB server\n');
	process.stdout.write('    "./nodebb log" to view server output\n');
	process.stdout.write('    "./nodebb restart" to restart NodeBB\n');
	
	child.unref();
	process.exit(0);
	
}

function compileLess(callback) {
	if ((nconf.get('from-file') || '').indexOf('less') !== -1) {
		winston.info('LESS compilation skipped');
		return callback(false);
	}

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
	if ((nconf.get('from-file') || '').indexOf('js') !== -1) {
		winston.info('Client-side JS compilation skipped');
		return callback(false);
	}

	var scriptPath = path.join(__dirname, '..'),
		result = uglify.minify(scripts.map(function(script) {
			return path.join(scriptPath, script);
		}));


	fs.writeFile(path.join(__dirname, '../public/nodebb.min.js'), result.code, callback);
}

module.exports = web;