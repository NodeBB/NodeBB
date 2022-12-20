
'use strict';

import fs from 'fs';
import util from 'util';
import path from 'path';
import os from 'os';
import nconf from 'nconf';
import express from 'express';
import chalk from 'chalk';

const expressApp = express();
(expressApp as any).renderAsync = util.promisify((tpl, data, callback) => expressApp.render(tpl, data, callback));
let appServer: any;
import winston from 'winston';
import flash from 'connect-flash';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import useragent from 'express-useragent';
import favicon from 'serve-favicon';
import detector from 'spider-detector';
import helmet from 'helmet';

import Benchpress from 'benchpressjs';
import db from './database';

import analytics from './analytics';
import file from './file';
import emailer from './emailer';
import meta from './meta';
import logger from './logger';
import plugins from './plugins';
import flags from './flags';
import topicEvents from './topics/events';
import privileges from './privileges';
import routes from './routes';
import auth from './routes/authentication';
import middleware from './middleware';
import compression from 'compression';
import net from 'net';
import toobusy from 'toobusy-js';
import * as pingController from './controllers/ping';
import appServerHttps from 'https';
import appServerHttp from 'http';
import als from './als';
import controllerHelpers from './controllers/helpers';





if (nconf.get('ssl')) {
	appServerHttps.createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert),
	}, expressApp);
} else {
	appServerHttp.createServer(expressApp);
}

export const server =  nconf.get('ssl') ? appServerHttps : appServerHttp;
export const app = expressApp;

appServer.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		winston.error(`NodeBB address in use, exiting...\n${err.stack}`);
	} else {
		winston.error(err.stack);
	}

	throw err;
});

// see https://github.com/isaacs/appServer-destroy/blob/master/index.js
const connections = {};
appServer.on('connection', (conn) => {
	const key = `${conn.remoteAddress}:${conn.remotePort}`;
	connections[key] = conn;
	conn.on('close', () => {
		delete connections[key];
	});
});

export const destroy = function (callback) {
	appServer.close(callback);
	for (const connection of Object.values(connections) as any) {
		connection.destroy();
	}
};

export const listen = async function () {
	emailer.registerexpressApp(expressApp);
	setupExpressexpressApp(expressApp);
	controllerHelpers.register();
	logger.init(expressApp);
	await initializeNodeBB();
	winston.info('🎉 NodeBB Ready');

	require('./socket.io').appServer.emit('event:nodebb.ready', {
		'cache-buster': meta.config['cache-buster'],
		hostname: os.hostname(),
	});

	plugins.hooks.fire('action:nodebb.ready');

	await listen2();
};

async function initializeNodeBB() {
	await meta.themes.setupPaths();
	await plugins.init(expressApp, middleware);		
	notifications.startJobs();
	user.startJobs();
	plugins.startJobs();
	topics.scheduled.startJobs();
	await plugins.hooks.fire('static:assets.prepare', {});
	await plugins.hooks.fire('static:expressApp.preload', {
		expressApp: expressApp,
		middleware: middleware,
	});
	await routes(expressApp, middleware);
	await privileges.init();
	await meta.blacklist.load();
	await flags.init();
	await analytics.init();
	await topicEvents.init();
}

function setupExpressexpressApp(expressApp) {

	const relativePath = nconf.get('relative_path');
	const viewsDir = nconf.get('views_dir');

	expressApp.engine('tpl', (filepath, data, next) => {
		filepath = filepath.replace(/\.tpl$/, '.js');

		Benchpress.__express(filepath, data, next);
	});
	expressApp.set('view engine', 'tpl');
	expressApp.set('views', viewsDir);
	expressApp.set('json spaces', (global as any).env === 'development' ? 4 : 0);
	expressApp.use(flash());

	expressApp.enable('view cache');

	if ((global as any).env !== 'development') {
		expressApp.enable('cache');
		expressApp.enable('minification');
	}

	if (meta.config.useCompression) {
		expressApp.use(compression());
	}
	if (relativePath) {
		expressApp.use((req, res, next) => {
			if (!req.path.startsWith(relativePath)) {
				return require('./controllers/helpers').redirect(res, req.path);
			}
			next();
		});
	}

	expressApp.get(`${relativePath}/ping`, pingController.ping);
	expressApp.get(`${relativePath}/sping`, pingController.ping);

	setupFavicon(expressApp);

	expressApp.use(`${relativePath}/expressApple-touch-icon`, middleware.routeTouchIcon);

	configureBodyParser(expressApp);

	expressApp.use(cookieParser(nconf.get('secret')));
	expressApp.use(useragent.express());
	expressApp.use(detector.middleware());
	expressApp.use(session({
		store: db.sessionStore,
		secret: nconf.get('secret'),
		key: nconf.get('sessionKey'),
		cookie: setupCookie(),
		resave: nconf.get('sessionResave') || false,
		saveUninitialized: nconf.get('sessionSaveUninitialized') || false,
	}));

	setupHelmet(expressApp);

	expressApp.use(middleware.addHeaders);
	expressApp.use(middleware.processRender);
	auth.initialize(expressApp, middleware);
	expressApp.use((req, res, next) => {
		als.run({ uid: req.uid }, next);
	});
	expressApp.use(middleware.autoLocale); // must be added after auth middlewares are added

	toobusy.maxLag(meta.config.eventLoopLagThreshold);
	toobusy.interval(meta.config.eventLoopInterval);
}

function setupHelmet(expressApp) {
	const options = {
		contentSecurityPolicy: false, // defaults are too restrive and break plugins that load external assets... 🔜
		crossOriginOpenerPolicy: { policy: meta.config['cross-origin-opener-policy'] },
		crossOriginResourcePolicy: { policy: meta.config['cross-origin-resource-policy'] },
		referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
	} as any;

	if (!meta.config['cross-origin-embedder-policy']) {
		options.crossOriginEmbedderPolicy = false;
	}
	if (meta.config['hsts-enabled']) {
		options.hsts = {
			maxAge: meta.config['hsts-maxage'],
			includeSubDomains: !!meta.config['hsts-subdomains'],
			preload: !!meta.config['hsts-preload'],
		};
	}

	expressApp.use(helmet(options));
}


function setupFavicon(expressApp) {
	let faviconPath = meta.config['brand:favicon'] || 'favicon.ico';
	faviconPath = path.join(nconf.get('base_dir'), 'public', faviconPath.replace(/assets\/uploads/, 'uploads'));
	if (file.existsSync(faviconPath)) {
		expressApp.use(nconf.get('relative_path'), favicon(faviconPath));
	}
}

function configureBodyParser(expressApp) {
	const urlencodedOpts = nconf.get('bodyParser:urlencoded') || {};
	if (!urlencodedOpts.hasOwnProperty('extended')) {
		urlencodedOpts.extended = true;
	}
	expressApp.use(bodyParser.urlencoded(urlencodedOpts));

	const jsonOpts = nconf.get('bodyParser:json') || {};
	expressApp.use(bodyParser.json(jsonOpts));
}

function setupCookie() {
	const cookie = meta.configs.cookie.get();
	const ttl = meta.getSessionTTLSeconds() * 1000;
	cookie.maxAge = ttl;

	return cookie;
}

async function listen2() {
	let port = nconf.get('port');
	const isSocket = isNaN(port) && !Array.isArray(port);
	const socketPath = isSocket ? nconf.get('port') : '';

	if (Array.isArray(port)) {
		if (!port.length) {
			winston.error('[startup] empty ports array in config.json');
			(process as any).exit();
		}

		winston.warn('[startup] If you want to start nodebb on multiple ports please use loader.js');
		winston.warn(`[startup] Defaulting to first port in array, ${port[0]}`);
		port = port[0];
		if (!port) {
			winston.error('[startup] Invalid port, exiting');
			(process as any).exit();
		}
	}
	port = parseInt(port, 10);
	if ((port !== 80 && port !== 443) || nconf.get('trust_proxy') === true) {
		winston.info('🤝 Enabling \'trust proxy\'');
		expressApp.enable('trust proxy');
	}

	if ((port === 80 || port === 443) && (process as any).env.NODE_ENV !== 'development') {
		winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
	}

	const bind_address = ((nconf.get('bind_address') === '0.0.0.0' || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address'));
	const args = isSocket ? [socketPath] : [port, bind_address];
	let oldUmask;

	if (isSocket) {
		oldUmask = (process as any).umask('0000');
		try {
			await testSocket(socketPath);
		} catch (err: any) {
			winston.error(`[startup] NodeBB was unable to secure domain socket access (${socketPath})\n${err.stack}`);
			throw err;
		}
	}

	return new Promise<void>((resolve, reject) => {
		appServer.listen(...args.concat([function (err) {
			const onText = `${isSocket ? socketPath : `${bind_address}:${port}`}`;
			if (err) {
				winston.error(`[startup] NodeBB was unable to listen on: ${chalk.yellow(onText)}`);
				reject(err);
			}

			winston.info(`📡 NodeBB is now listening on: ${chalk.yellow(onText)}`);
			winston.info(`🔗 Canonical URL: ${chalk.yellow(nconf.get('url'))}`);
			if (oldUmask) {
				(process as any).umask(oldUmask);
			}
			resolve();
		}]));
	});
}

export const testSocket = async function (socketPath) {
	if (typeof socketPath !== 'string') {
		throw new Error(`invalid socket path : ${socketPath}`);
	}
	const exists = await file.exists(socketPath);
	if (!exists) {
		return;
	}
	return new Promise<void>((resolve, reject) => {
		const testSocket = new net.Socket();
		testSocket.on('error', (err: any) => {
			if (err.code !== 'ECONNREFUSED') {
				return reject(err);
			}
			// The socket was stale, kick it out of the way
			fs.unlink(socketPath, (err) => {
				if (err) reject(err); else resolve();
			});
		});
		testSocket.connect({ path: socketPath }, () => {
			// Something's listening here, abort
			reject(new Error('port-in-use'));
		});
	});
};

import promisify from './promisify';
import notifications from './notifications';
import topics from './topics';
import user from './user';
promisify(exports);
