
'use strict';

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
	meta = require('./meta'),
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
	var	port = nconf.get('PORT') || nconf.get('port');

	module.exports.init = function() {
		emailer.registerApp(app);

		// Preparation dependent on plugins
		plugins.ready(function() {
			async.parallel([
				async.apply(!nconf.get('from-file') ? meta.js.minify : meta.js.getFromFile, app.enabled('minification')),
				async.apply(!nconf.get('from-file') ? meta.css.minify : meta.css.getFromFile),
				async.apply(meta.sounds.init)
			]);
		});

		middleware = middleware(app);
		routes(app, middleware);

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
	};

	server.on('error', function(err) {
		winston.error(err.stack);
		console.log(err.stack);
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

	module.exports.server = server;

	emitter.all(['templates:compiled', 'meta:js.compiled', 'meta:css.compiled'], function() {
		winston.info('NodeBB Ready');
		emitter.emit('nodebb:ready');
	});

	module.exports.listen = function(callback) {
		logger.init(app);

		var	bind_address = ((nconf.get('bind_address') === "0.0.0.0" || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address')) + ':' + port;
		if (cluster.isWorker) {
			port = 0;
		}
		server.listen(port, nconf.get('bind_address'), function(err) {
			if (err) {
				winston.info('NodeBB was unable to listen on: ' + bind_address);
				return callback(err);
			}

			winston.info('NodeBB is now listening on: ' + bind_address);
			if (process.send) {
				process.send({
					action: 'listening',
					bind_address: bind_address,
					primary: process.env.handle_jobs === 'true'
				});
			}

			callback();
		});
	};

	process.on('message', function(message, connection) {
		if (!message || message.action !== 'sticky-session:connection') {
			return;
		}

		process.send({action: 'sticky-session:accept', handleIndex: message.handleIndex});
		server.emit('connection', connection);
	});

}(WebServer));
