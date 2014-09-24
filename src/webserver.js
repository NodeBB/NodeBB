var path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),
	WebServer = express(),
	server,
	winston = require('winston'),
	async = require('async'),
	cluster = require('cluster'),

	emailer = require('./emailer'),
	db = require('./database'),
	auth = require('./routes/authentication'),
	meta = require('./meta'),
	user = require('./user'),
	notifications = require('./notifications'),
	logger = require('./logger'),
	plugins = require('./plugins'),
	middleware = require('./middleware'),
	routes = require('./routes'),
	emitter = require('./emitter'),

	helpers = require('./../public/src/helpers')();

if(nconf.get('ssl')) {
	server = require('https').createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert)
	}, WebServer);
} else {
	server = require('http').createServer(WebServer);
}

(function (app) {
	"use strict";

	var	port = nconf.get('PORT') || nconf.get('port');

	logger.init(app);
	emailer.registerApp(app);

	if (cluster.isWorker && process.env.handle_jobs === 'true') {
		notifications.init();
		user.startJobs();
	}

	// Preparation dependent on plugins
	plugins.ready(function() {
		meta.js.minify(app.enabled('minification'));
		meta.css.minify();

		if (cluster.isWorker && process.env.cluster_setup === 'true') {
			meta.sounds.init();
		}
	});

	async.parallel({
		themesData: meta.themes.get,
		currentThemeId: function(next) {
			db.getObjectField('config', 'theme:id', next);
		}
	}, function(err, data) {
		middleware = middleware(app, data);
		routes(app, middleware);

		if (err) {
			winston.error('Errors were encountered while attempting to initialise NodeBB.');
			process.exit();
		} else {
			if (process.env.NODE_ENV === 'development') {
				winston.info('Middlewares loaded.');
			}
		}
	});

	// Cache static files on production
	if (global.env !== 'development') {
		app.enable('cache');
		app.enable('minification');

		// Configure cache-buster timestamp
		require('child_process').exec('git describe --tags', {
			cwd: path.join(__dirname, '../')
		}, function(err, stdOut) {
			if (!err) {
				meta.config['cache-buster'] = stdOut.trim();
			} else {
				fs.stat(path.join(__dirname, '../package.json'), function(err, stats) {
					meta.config['cache-buster'] = new Date(stats.mtime).getTime();
				});
			}
		});
	}

	if (port !== 80 && port !== 443 && nconf.get('use_port') === false) {
		winston.info('Enabling \'trust proxy\'');
		app.enable('trust proxy');
	}

	if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
		winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
	}

	module.exports.server = server;
	module.exports.init = function(callback) {
		server.on("error", function(err){
			if (err.code === 'EADDRINUSE') {
				winston.error('NodeBB address in use, exiting...');
				if (cluster.isWorker) {
					cluster.worker.kill();
				} else {
					process.exit(0);
				}
			} else {
				throw err;
			}
		});

		emitter.all(['templates:compiled', 'meta:js.compiled', 'meta:css.compiled'], function() {
			winston.info('NodeBB Ready');
			emitter.emit('nodebb:ready');
			emitter.removeAllListeners('templates:compiled').removeAllListeners('meta:js.compiled').removeAllListeners('meta:css.compiled');
		});

		if (process.send) {
			callback();
		} else {
			module.exports.listen();
		}
	};

	module.exports.listen = function() {
		var	bind_address = ((nconf.get('bind_address') === "0.0.0.0" || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address')) + ':' + port;
		winston.info('NodeBB attempting to listen on: ' + bind_address);

		server.listen(port, nconf.get('bind_address'), function() {
			winston.info('NodeBB is now listening on: ' + bind_address);
			if (process.send) {
				process.send({
					action: 'listening',
					bind_address: bind_address,
					primary: process.env.handle_jobs === 'true'
				});
			}
		});
	};

}(WebServer));
