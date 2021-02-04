
'use strict';

var fs = require('fs');
const util = require('util');
var path = require('path');
var os = require('os');
var nconf = require('nconf');
var express = require('express');

var app = express();
app.renderAsync = util.promisify((tpl, data, callback) => app.render(tpl, data, callback));
var server;
var winston = require('winston');
var async = require('async');
var flash = require('connect-flash');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var useragent = require('express-useragent');
var favicon = require('serve-favicon');
var detector = require('spider-detector');
var helmet = require('helmet');

var Benchpress = require('benchpressjs');
var db = require('./database');
var analytics = require('./analytics');
var file = require('./file');
var emailer = require('./emailer');
var meta = require('./meta');
var logger = require('./logger');
var plugins = require('./plugins');
var flags = require('./flags');
var routes = require('./routes');
var auth = require('./routes/authentication');

var helpers = require('../public/src/modules/helpers');

if (nconf.get('ssl')) {
	server = require('https').createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert),
	}, app);
} else {
	server = require('http').createServer(app);
}

module.exports.server = server;
module.exports.app = app;

server.on('error', function (err) {
	if (err.code === 'EADDRINUSE') {
		winston.error('NodeBB address in use, exiting...\n' + err.stack);
	} else {
		winston.error(err.stack);
	}

	throw err;
});

// see https://github.com/isaacs/server-destroy/blob/master/index.js
var connections = {};
server.on('connection', function (conn) {
	var key = conn.remoteAddress + ':' + conn.remotePort;
	connections[key] = conn;
	conn.on('close', function () {
		delete connections[key];
	});
});

exports.destroy = function (callback) {
	server.close(callback);
	for (var key in connections) {
		if (connections.hasOwnProperty(key)) {
			connections[key].destroy();
		}
	}
};

exports.listen = async function () {
	emailer.registerApp(app);
	setupExpressApp(app);
	helpers.register();
	logger.init(app);
	await initializeNodeBB();
	winston.info('NodeBB Ready');

	require('./socket.io').server.emit('event:nodebb.ready', {
		'cache-buster': meta.config['cache-buster'],
		hostname: os.hostname(),
	});

	plugins.hooks.fire('action:nodebb.ready');

	await util.promisify(listen)();
};

async function initializeNodeBB() {
	const middleware = require('./middleware');
	await meta.themes.setupPaths();
	await plugins.init(app, middleware);
	await plugins.hooks.fire('static:assets.prepare', {});
	await plugins.hooks.fire('static:app.preload', {
		app: app,
		middleware: middleware,
	});
	await routes(app, middleware);
	await meta.blacklist.load();
	await flags.init();
	await analytics.init();
}

function setupExpressApp(app) {
	const middleware = require('./middleware');
	const pingController = require('./controllers/ping');

	const relativePath = nconf.get('relative_path');
	const viewsDir = nconf.get('views_dir');

	app.engine('tpl', function (filepath, data, next) {
		filepath = filepath.replace(/\.tpl$/, '.js');

		Benchpress.__express(filepath, data, next);
	});
	app.set('view engine', 'tpl');
	app.set('views', viewsDir);
	app.set('json spaces', global.env === 'development' ? 4 : 0);
	app.use(flash());

	app.enable('view cache');

	if (global.env !== 'development') {
		app.enable('cache');
		app.enable('minification');
	}

	if (meta.config.useCompression) {
		const compression = require('compression');
		app.use(compression());
	}

	app.get(relativePath + '/ping', pingController.ping);
	app.get(relativePath + '/sping', pingController.ping);

	setupFavicon(app);

	app.use(relativePath + '/apple-touch-icon', middleware.routeTouchIcon);

	configureBodyParser(app);

	app.use(cookieParser(nconf.get('secret')));
	const userAgentMiddleware = useragent.express();
	app.use(function userAgent(req, res, next) {
		userAgentMiddleware(req, res, next);
	});
	const spiderDetectorMiddleware = detector.middleware();
	app.use(function spiderDetector(req, res, next) {
		spiderDetectorMiddleware(req, res, next);
	});

	app.use(session({
		store: db.sessionStore,
		secret: nconf.get('secret'),
		key: nconf.get('sessionKey'),
		cookie: setupCookie(),
		resave: nconf.get('sessionResave') || false,
		saveUninitialized: nconf.get('sessionSaveUninitialized') || false,
	}));

	setupHelmet(app);

	app.use(middleware.addHeaders);
	app.use(middleware.processRender);
	auth.initialize(app, middleware);
	app.use(middleware.autoLocale);	// must be added after auth middlewares are added

	var toobusy = require('toobusy-js');
	toobusy.maxLag(meta.config.eventLoopLagThreshold);
	toobusy.interval(meta.config.eventLoopInterval);
}

function setupHelmet(app) {
	app.use(helmet.dnsPrefetchControl());
	app.use(helmet.expectCt());
	app.use(helmet.frameguard());
	app.use(helmet.hidePoweredBy());
	app.use(helmet.ieNoOpen());
	app.use(helmet.noSniff());
	app.use(helmet.permittedCrossDomainPolicies());
	app.use(helmet.xssFilter());

	app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
	if (meta.config['hsts-enabled']) {
		app.use(helmet.hsts({
			maxAge: meta.config['hsts-maxage'],
			includeSubDomains: !!meta.config['hsts-subdomains'],
			preload: !!meta.config['hsts-preload'],
		}));
	}
}


function setupFavicon(app) {
	var faviconPath = meta.config['brand:favicon'] || 'favicon.ico';
	faviconPath = path.join(nconf.get('base_dir'), 'public', faviconPath.replace(/assets\/uploads/, 'uploads'));
	if (file.existsSync(faviconPath)) {
		app.use(nconf.get('relative_path'), favicon(faviconPath));
	}
}

function configureBodyParser(app) {
	const urlencodedOpts = nconf.get('bodyParser:urlencoded') || {};
	if (!urlencodedOpts.hasOwnProperty('extended')) {
		urlencodedOpts.extended = true;
	}
	app.use(bodyParser.urlencoded(urlencodedOpts));

	const jsonOpts = nconf.get('bodyParser:json') || {};
	app.use(bodyParser.json(jsonOpts));
}

function setupCookie() {
	const cookie = meta.configs.cookie.get();
	const ttl = meta.getSessionTTLSeconds() * 1000;
	cookie.maxAge = ttl;

	return cookie;
}

function listen(callback) {
	callback = callback || function () { };
	var port = nconf.get('port');
	var isSocket = isNaN(port) && !Array.isArray(port);
	var socketPath = isSocket ? nconf.get('port') : '';

	if (Array.isArray(port)) {
		if (!port.length) {
			winston.error('[startup] empty ports array in config.json');
			process.exit();
		}

		winston.warn('[startup] If you want to start nodebb on multiple ports please use loader.js');
		winston.warn('[startup] Defaulting to first port in array, ' + port[0]);
		port = port[0];
		if (!port) {
			winston.error('[startup] Invalid port, exiting');
			process.exit();
		}
	}
	port = parseInt(port, 10);
	if ((port !== 80 && port !== 443) || nconf.get('trust_proxy') === true) {
		winston.info('Enabling \'trust proxy\'');
		app.enable('trust proxy');
	}

	if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
		winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
	}

	var bind_address = ((nconf.get('bind_address') === '0.0.0.0' || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address'));
	var args = isSocket ? [socketPath] : [port, bind_address];
	var oldUmask;

	args.push(function (err) {
		if (err) {
			winston.info('[startup] NodeBB was unable to listen on: ' + bind_address + ':' + port);
			process.exit();
		}

		winston.info('NodeBB is now listening on: ' + (isSocket ? socketPath : bind_address + ':' + port));
		if (oldUmask) {
			process.umask(oldUmask);
		}
		callback();
	});

	// Alter umask if necessary
	if (isSocket) {
		oldUmask = process.umask('0000');
		module.exports.testSocket(socketPath, function (err) {
			if (err) {
				winston.error('[startup] NodeBB was unable to secure domain socket access (' + socketPath + ')\n' + err.stack);
				throw err;
			}

			server.listen.apply(server, args);
		});
	} else {
		server.listen.apply(server, args);
	}
}

exports.testSocket = function (socketPath, callback) {
	if (typeof socketPath !== 'string') {
		return callback(new Error('invalid socket path : ' + socketPath));
	}
	var net = require('net');
	var file = require('./file');
	async.series([
		function (next) {
			file.exists(socketPath, function (err, exists) {
				if (exists) {
					next();
				} else {
					callback(err);
				}
			});
		},
		function (next) {
			var testSocket = new net.Socket();
			testSocket.on('error', function (err) {
				next(err.code !== 'ECONNREFUSED' ? err : null);
			});
			testSocket.connect({ path: socketPath }, function () {
				// Something's listening here, abort
				callback(new Error('port-in-use'));
			});
		},
		async.apply(fs.unlink, socketPath),	// The socket was stale, kick it out of the way
	], callback);
};

require('./promisify')(exports);
