'use strict';

const os = require('os');
const nconf = require('nconf');
const winston = require('winston');
const url = require('url');
const util = require('util');
const cookieParser = require('cookie-parser')(nconf.get('secret'));

const db = require('../database');
const user = require('../user');
const logger = require('../logger');
const plugins = require('../plugins');
const ratelimit = require('../middleware/ratelimit');


const Namespaces = {};

const Sockets = module.exports;

Sockets.init = function (server) {
	requireModules();

	const SocketIO = require('socket.io');
	const socketioWildcard = require('socketio-wildcard')();
	const io = new SocketIO({
		path: nconf.get('relative_path') + '/socket.io',
	});

	if (nconf.get('singleHostCluster')) {
		io.adapter(require('./single-host-cluster'));
	} else if (nconf.get('redis')) {
		io.adapter(require('../database/redis').socketAdapter());
	} else {
		io.adapter(db.socketAdapter());
	}

	io.use(socketioWildcard);
	io.use(authorize);

	io.on('connection', onConnection);

	/*
	 * Restrict socket.io listener to cookie domain. If none is set, infer based on url.
	 * Production only so you don't get accidentally locked out.
	 * Can be overridden via config (socket.io:origins)
	 */
	if (process.env.NODE_ENV !== 'development') {
		const parsedUrl = url.parse(nconf.get('url'));

		// cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
		const domain = nconf.get('cookieDomain') || parsedUrl.hostname;

		const origins = nconf.get('socket.io:origins') || `${parsedUrl.protocol}//${domain}:*`;
		nconf.set('socket.io:origins', origins);

		io.origins(origins);
		winston.info('[socket.io] Restricting access to origin: ' + origins);
	}

	io.listen(server, {
		transports: nconf.get('socket.io:transports'),
		cookie: false,
	});

	Sockets.server = io;
};

function onConnection(socket) {
	socket.ip = (socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress || '').split(',')[0];

	logger.io_one(socket, socket.uid);

	onConnect(socket);

	socket.on('*', function (payload) {
		onMessage(socket, payload);
	});
}

function onConnect(socket) {
	if (socket.uid) {
		socket.join('uid_' + socket.uid);
		socket.join('online_users');
	} else {
		socket.join('online_guests');
	}

	socket.join('sess_' + socket.request.signedCookies[nconf.get('sessionKey')]);
	Sockets.server.sockets.sockets[socket.id].emit('checkSession', socket.uid);
	Sockets.server.sockets.sockets[socket.id].emit('setHostname', os.hostname());
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
			winston.warn('[socket.io] Unrecognized message: ' + eventName);
		}
		return callback({ message: '[[error:invalid-event]]' });
	}

	socket.previousEvents = socket.previousEvents || [];
	socket.previousEvents.push(eventName);
	if (socket.previousEvents.length > 20) {
		socket.previousEvents.shift();
	}

	if (!eventName.startsWith('admin.') && ratelimit.isFlooding(socket)) {
		winston.warn('[socket.io] Too many emits! Disconnecting uid : ' + socket.uid + '. Events : ' + socket.previousEvents);
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
		callback({ message: err.message });
	}
}

function requireModules() {
	var modules = ['admin', 'categories', 'groups', 'meta', 'modules',
		'notifications', 'plugins', 'posts', 'topics', 'user', 'blacklist', 'flags',
	];

	modules.forEach(function (module) {
		Namespaces[module] = require('./' + module);
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
	throw new Error('[[error:forum-maintenance]]');
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
	const result = await plugins.fireHook('static:sockets.validateSession', {
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

	callback();
}

Sockets.in = function (room) {
	return Sockets.server && Sockets.server.in(room);
};

Sockets.getUserSocketCount = function (uid) {
	if (!Sockets.server) {
		return 0;
	}

	const room = Sockets.server.sockets.adapter.rooms['uid_' + uid];
	return room ? room.length : 0;
};


Sockets.reqFromSocket = function (socket, payload, event) {
	var headers = socket.request ? socket.request.headers : {};
	var encrypted = socket.request ? !!socket.request.connection.encrypted : false;
	var host = headers.host;
	var referer = headers.referer || '';
	var data = ((payload || {}).data || []);

	if (!host) {
		host = url.parse(referer).host || '';
	}

	return {
		uid: socket.uid,
		params: data[1],
		method: event || data[0],
		body: payload,
		ip: socket.ip,
		host: host,
		protocol: encrypted ? 'https' : 'http',
		secure: encrypted,
		url: referer,
		path: referer.substr(referer.indexOf(host) + host.length),
		headers: headers,
	};
};
