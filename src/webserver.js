
'use strict';

var path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),
	WebServer = express(),
	server,
	winston = require('winston'),
	async = require('async'),

	emailer = require('./emailer'),
	meta = require('./meta'),
	logger = require('./logger'),
	plugins = require('./plugins'),
	middleware = require('./middleware'),
	routes = require('./routes'),
	emitter = require('./emitter'),

	helpers = require('./../public/src/helpers')(),
	net;

if(nconf.get('ssl')) {
	server = require('https').createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert)
	}, WebServer);
} else {
	server = require('http').createServer(WebServer);
}

(function (app) {
	var	port = nconf.get('port');

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
			process.exit(0);
		} else {
			throw err;
		}
	});

	module.exports.server = server;

	emitter.all(['templates:compiled', 'meta:js.compiled', 'meta:css.compiled'], function() {
		winston.info('NodeBB Ready');
		emitter.emit('nodebb:ready');
	});

	server.setTimeout(10000);

	module.exports.listen = function(callback) {
		logger.init(app);

		var isSocket = isNaN(port),
			args = isSocket ? [port] : [port, nconf.get('bind_address')],
			bind_address = ((nconf.get('bind_address') === "0.0.0.0" || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address')) + ':' + port,
			oldUmask;

		args.push(function(err) {
			if (err) {
				winston.info('[startup] NodeBB was unable to listen on: ' + bind_address);
				return callback(err);
			}

			winston.info('NodeBB is now listening on: ' + (isSocket ? port : bind_address));
			if (oldUmask) {
				process.umask(oldUmask);
			}

			callback();
		});

		// Alter umask if necessary
		if (isSocket) {
			oldUmask = process.umask('0000');
			net = require('net');
			module.exports.testSocket(port, function(err) {
				if (!err) {
					server.listen.apply(server, args);
				} else {
					winston.error('[startup] NodeBB was unable to secure domain socket access (' + port + ')');
					winston.error('[startup] ' + err.message);
					process.exit();
				}
			});
		} else {
			server.listen.apply(server, args);
		}
	};

	module.exports.testSocket = function(socketPath, callback) {
		async.series([
			function(next) {
				fs.exists(socketPath, function(exists) {
					if (exists) {
						next();
					} else {
						callback();
					}
				});
			},
			function(next) {
				var testSocket = new net.Socket();
				testSocket.on('error', function(err) {
					next(err.code !== 'ECONNREFUSED' ? err : null);
				});
				testSocket.connect({ path: socketPath }, function() {
					// Something's listening here, abort
					callback(new Error('port-in-use'));
				});
			},
			async.apply(fs.unlink, socketPath),	// The socket was stale, kick it out of the way
		], callback);
	};

}(WebServer));
