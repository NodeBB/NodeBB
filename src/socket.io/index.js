'use strict';

const os = require('os');
const nconf = require('nconf');
const winston = require('winston');
const util = require('util');
const cookieParser = require('cookie-parser')(nconf.get('secret'));

const db = require('../database');
const user = require('../user');
const logger = require('../logger');
const plugins = require('../plugins');
const ratelimit = require('../middleware/ratelimit');

const Namespaces = {};

const Sockets = module.exports;

Sockets.init = async function (server) {
	requireModules();

	const SocketIO = require('socket.io').Server;
	const io = new SocketIO({
		path: `${nconf.get('relative_path')}/socket.io`,
	});

	if (nconf.get('isCluster')) {
		// socket.io-adapter-cluster needs update
		// if (nconf.get('singleHostCluster')) {
		// 	io.adapter(require('./single-host-cluster'));
		// } else if (nconf.get('redis')) {
		if (nconf.get('redis')) {
			const adapter = await require('../database/redis').socketAdapter();
			io.adapter(adapter);
		} else {
			winston.warn('clustering detected, you should setup redis!');
		}
	}

	io.use(authorize);

	io.on('connection', onConnection);

	const opts = {
		transports: nconf.get('socket.io:transports') || ['polling', 'websocket'],
		cookie: false,
	};
	/*
	 * Restrict socket.io listener to cookie domain. If none is set, infer based on url.
	 * Production only so you don't get accidentally locked out.
	 * Can be overridden via config (socket.io:origins)
	 */
	if (process.env.NODE_ENV !== 'development') {
		const origins = nconf.get('socket.io:origins');
		opts.cors = {
			origin: origins,
			methods: ['GET', 'POST'],
			allowedHeaders: ['content-type'],
		};
		winston.info(`[socket.io] Restricting access to origin: ${origins}`);
	}

	io.listen(server, opts);
	Sockets.server = io;
};

function onConnection(socket) {
	socket.ip = (socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress || '').split(',')[0];
	socket.request.ip = socket.ip;
	logger.io_one(socket, socket.uid);

	onConnect(socket);
	socket.onAny((event, ...args) => {
		const payload = { data: [event].concat(args) };
		onMessage(socket, payload);
	});

	socket.on('disconnect', function () {
		onDisconnect(socket);
	});
}

function onDisconnect(socket) {
	require('./uploads').clear(socket.id);
	plugins.hooks.fire('action:sockets.disconnect', { socket: socket });
}

function onConnect(socket) {
	if (socket.uid) {
		socket.join(`uid_${socket.uid}`);
		socket.join('online_users');
	} else {
		socket.join('online_guests');
	}

	socket.join(`sess_${socket.request.signedCookies[nconf.get('sessionKey')]}`);
	socket.emit('checkSession', socket.uid);
	socket.emit('setHostname', os.hostname());
	plugins.hooks.fire('action:sockets.connect', { socket: socket });
}

async function onMessage(socket, payload) {
	if (!payload.data.length) {
		return winston.warn('[socket.io] Empty payload');
	}

	const eventName = payload.data[0];
	const params = typeof payload.data[1] === 'function' ? {} : payload.data[1];
	const callback = typeof payload.data[payload.data.length - 1] === 'function' ? payload.data[payload.data.length - 1] : function () {};

	if (!eventName) {
		return winston.warn('[socket.io] Empty method name');
	}

	const parts = eventName.toString().split('.');
	const namespace = parts[0];
	const methodToCall = parts.reduce(function (prev, cur) {
		if (prev !== null && prev[cur]) {
			return prev[cur];
		}
		return null;
	}, Namespaces);

	if (!methodToCall || typeof methodToCall !== 'function') {
		if (process.env.NODE_ENV === 'development') {
			winston.warn(`[socket.io] Unrecognized message: ${eventName}`);
		}
		return callback({ message: '[[error:invalid-event]]' });
	}

	socket.previousEvents = socket.previousEvents || [];
	socket.previousEvents.push(eventName);
	if (socket.previousEvents.length > 20) {
		socket.previousEvents.shift();
	}

	if (!eventName.startsWith('admin.') && ratelimit.isFlooding(socket)) {
		winston.warn(`[socket.io] Too many emits! Disconnecting uid : ${socket.uid}. Events : ${socket.previousEvents}`);
		return socket.disconnect();
	}

	try {
		await checkMaintenance(socket);
		await validateSession(socket);

		if (Namespaces[namespace].before) {
			await Namespaces[namespace].before(socket, eventName, params);
		}

		if (methodToCall.constructor && methodToCall.constructor.name === 'AsyncFunction') {
			const result = await methodToCall(socket, params);
			callback(null, result);
		} else {
			methodToCall(socket, params, function (err, result) {
				callback(err ? { message: err.message } : null, result);
			});
		}
	} catch (err) {
		winston.error(`${eventName}\n${err.stack ? err.stack : err.message}`);
		callback({ message: err.message });
	}
}

function requireModules() {
	var modules = ['admin', 'categories', 'groups', 'meta', 'modules',
		'notifications', 'plugins', 'posts', 'topics', 'user', 'blacklist',
		'flags', 'uploads',
	];

	modules.forEach(function (module) {
		Namespaces[module] = require(`./${module}`);
	});
}

async function checkMaintenance(socket) {
	const meta = require('../meta');
	if (!meta.config.maintenanceMode) {
		return;
	}
	const isAdmin = await user.isAdministrator(socket.uid);
	if (isAdmin) {
		return;
	}
	const validator = require('validator');
	throw new Error(`[[pages:maintenance.text, ${validator.escape(String(meta.config.title || 'NodeBB'))}]]`);
}

const getSessionAsync = util.promisify((sid, callback) => db.sessionStore.get(sid, (err, sessionObj) => callback(err, sessionObj || null)));

async function validateSession(socket) {
	var req = socket.request;
	if (!req.signedCookies || !req.signedCookies[nconf.get('sessionKey')]) {
		return;
	}
	const sessionData = await getSessionAsync(req.signedCookies[nconf.get('sessionKey')]);
	if (!sessionData) {
		throw new Error('[[error:invalid-session]]');
	}
	const result = await plugins.hooks.fire('static:sockets.validateSession', {
		req: req,
		socket: socket,
		session: sessionData,
	});
	return result;
}

const cookieParserAsync = util.promisify((req, callback) => cookieParser(req, {}, err => callback(err)));

async function authorize(socket, callback) {
	const request = socket.request;

	if (!request) {
		return callback(new Error('[[error:not-authorized]]'));
	}

	await cookieParserAsync(request);
	const sessionData = await getSessionAsync(request.signedCookies[nconf.get('sessionKey')]);
	if (sessionData && sessionData.passport && sessionData.passport.user) {
		request.session = sessionData;
		socket.uid = parseInt(sessionData.passport.user, 10);
	} else {
		socket.uid = 0;
	}
	request.uid = socket.uid;
	callback();
}

Sockets.in = function (room) {
	return Sockets.server && Sockets.server.in(room);
};

Sockets.getUserSocketCount = function (uid) {
	return Sockets.getCountInRoom(`uid_${uid}`);
};

Sockets.getCountInRoom = function (room) {
	if (!Sockets.server) {
		return 0;
	}
	const roomMap = Sockets.server.sockets.adapter.rooms.get(room);
	return roomMap ? roomMap.size : 0;
};

Sockets.warnDeprecated = (socket, replacement) => {
	if (socket.previousEvents) {
		socket.emit('event:deprecated_call', {
			eventName: socket.previousEvents[socket.previousEvents.length - 1],
			replacement: replacement,
		});
	}
	winston.warn(`[deprecated]\n ${new Error('-').stack.split('\n').slice(2, 5).join('\n')}\n     use ${replacement}`);
};
