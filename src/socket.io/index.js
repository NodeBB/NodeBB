'use strict';

const _ = require('lodash');
const os = require('os');
const nconf = require('nconf');
const winston = require('winston');
const util = require('util');
const validator = require('validator');
const cookieParser = require('cookie-parser')(nconf.get('secret'));

const db = require('../database');
const user = require('../user');
const logger = require('../logger');
const plugins = require('../plugins');
const ratelimit = require('../middleware/ratelimit');
const blacklist = require('../meta/blacklist');
const als = require('../als');
const apiHelpers = require('../api/helpers');

const Namespaces = Object.create(null);

const Sockets = module.exports;

Sockets.init = async function (server) {
	requireModules();

	const SocketIO = require('socket.io').Server;
	const io = new SocketIO({
		path: `${nconf.get('relative_path')}/socket.io`,
	});

	if (nconf.get('isCluster')) {
		if (nconf.get('redis')) {
			const adapter = await require('../database/redis').socketAdapter();
			io.adapter(adapter);
		} else {
			winston.warn('clustering detected, you should setup redis!');
		}
	}

	io.on('connection', onConnection);

	const opts = {
		transports: nconf.get('socket.io:transports') || ['polling', 'websocket'],
		cookie: false,
		allowRequest: (req, callback) => {
			authorize(req, (err) => {
				if (err) {
					return callback(err);
				}
				const csrf = require('../middleware/csrf');
				const isValid = csrf.isRequestValid({
					session: req.session || {},
					query: req._query,
					headers: req.headers,
				});
				callback(null, isValid);
			});
		},
	};
	/*
	 * Restrict socket.io listener to cookie domain. If none is set, infer based on url.
	 * Production only so you don't get accidentally locked out.
	 * Can be overridden via config (socket.io:origins)
	 */
	if (process.env.NODE_ENV !== 'development' || nconf.get('socket.io:cors')) {
		const origins = nconf.get('socket.io:origins');
		opts.cors = nconf.get('socket.io:cors') || {
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
	socket.uid = socket.request.uid;
	socket.data.uid = socket.uid; // socket.data is shared between nodes via fetchSockets
	socket.ip = (
		socket.request.headers['x-forwarded-for'] ||
		socket.request.connection.remoteAddress || ''
	).split(',')[0];
	socket.request.ip = socket.ip;
	logger.io_one(socket, socket.uid);

	onConnect(socket);
	socket.onAny((event, ...args) => {
		const payload = { event: event, ...deserializePayload(args) };

		als.run({
			uid: socket.uid,
			req: apiHelpers.buildReqObject(socket, payload),
			socket: { ...payload },
		}, onMessage, socket, payload);
	});

	socket.on('disconnecting', () => {
		for (const room of socket.rooms) {
			if (room && room.match(/^chat_room_\d+$/)) {
				Sockets.server.in(room).emit('event:chats.typing', {
					roomId: room.split('_').pop(),
					uid: socket.uid,
					username: '',
					typing: false,
				});
			}
		}
	});

	socket.on('disconnect', () => {
		onDisconnect(socket);
	});
}

function onDisconnect(socket) {
	require('./uploads').clear(socket.id);
	plugins.hooks.fire('action:sockets.disconnect', { socket: socket });
}

async function onConnect(socket) {
	try {
		await validateSession(socket, '[[error:invalid-session]]');
	} catch (e) {
		if (e.message === '[[error:invalid-session]]') {
			socket.emit('event:invalid_session');
		}

		return;
	}

	if (socket.uid > 0) {
		socket.join(`uid_${socket.uid}`);
		socket.join('online_users');
	} else if (socket.uid === 0) {
		socket.join('online_guests');
	}

	socket.join(`sess_${socket.request.signedCookies[nconf.get('sessionKey')]}`);
	socket.emit('checkSession', socket.uid);
	socket.emit('setHostname', os.hostname());
	plugins.hooks.fire('action:sockets.connect', { socket: socket });
}

function deserializePayload(payload) {
	if (!Array.isArray(payload) || !payload.length) {
		winston.warn('[socket.io] Empty payload');
		return {};
	}
	const params = typeof payload[0] === 'function' ? {} : payload[0];
	const callback = typeof payload[payload.length - 1] === 'function' ? payload[payload.length - 1] : function () {};
	return { params, callback };
}

async function onMessage(socket, payload) {
	const { event, params, callback } = payload;
	try {
		if (!event) {
			return winston.warn('[socket.io] Empty method name');
		}

		if (typeof event !== 'string') {
			const escapedName = validator.escape(typeof event);
			return callback({ message: `[[error:invalid-event, ${escapedName}]]` });
		}

		const parts = event.split('.');
		const namespace = parts[0];
		const methodToCall = parts.reduce((prev, cur) => {
			if (prev !== null && prev[cur] && (!prev.hasOwnProperty || prev.hasOwnProperty(cur))) {
				return prev[cur];
			}
			return null;
		}, Namespaces);

		if (!methodToCall || typeof methodToCall !== 'function') {
			if (process.env.NODE_ENV === 'development') {
				winston.warn(`[socket.io] Unrecognized message: ${event}`);
			}
			const escapedName = validator.escape(String(event));
			return callback({ message: `[[error:invalid-event, ${escapedName}]]` });
		}

		socket.previousEvents = socket.previousEvents || [];
		socket.previousEvents.push(event);
		if (socket.previousEvents.length > 20) {
			socket.previousEvents.shift();
		}

		if (!event.startsWith('admin.') && ratelimit.isFlooding(socket)) {
			winston.warn(`[socket.io] Too many emits! Disconnecting uid : ${socket.uid}. Events : ${socket.previousEvents}`);
			return socket.disconnect();
		}

		await blacklist.test(socket.ip);
		await checkMaintenance(socket);
		await validateSession(socket, '[[error:revalidate-failure]]');

		if (Namespaces[namespace].before) {
			await Namespaces[namespace].before(socket, event, params);
		}

		if (methodToCall.constructor && methodToCall.constructor.name === 'AsyncFunction') {
			const result = await methodToCall(socket, params);
			callback(null, result);
		} else {
			methodToCall(socket, params, (err, result) => {
				callback(err ? { message: err.message } : null, result);
			});
		}
	} catch (err) {
		winston.debug(`${event}\n${err.stack ? err.stack : err.message}`);
		callback({ message: err.message });
	}
}

function requireModules() {
	const modules = [
		'admin', 'categories', 'groups', 'meta', 'modules',
		'notifications', 'plugins', 'posts', 'topics', 'user',
		'blacklist', 'uploads',
	];

	modules.forEach((module) => {
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

async function validateSession(socket, errorMsg) {
	const req = socket.request;
	const { sessionId } = await plugins.hooks.fire('filter:sockets.sessionId', {
		sessionId: req.signedCookies ? req.signedCookies[nconf.get('sessionKey')] : null,
		request: req,
	});

	if (!sessionId) {
		return;
	}

	const sessionData = await db.sessionStoreGet(sessionId);
	if (!sessionData) {
		throw new Error(errorMsg);
	}

	await plugins.hooks.fire('static:sockets.validateSession', {
		req: req,
		socket: socket,
		session: sessionData,
	});
}

const cookieParserAsync = util.promisify((req, callback) => cookieParser(req, {}, err => callback(err)));

async function authorize(request, callback) {
	if (!request) {
		return callback(new Error('[[error:not-authorized]]'));
	}

	await cookieParserAsync(request);

	const { sessionId } = await plugins.hooks.fire('filter:sockets.sessionId', {
		sessionId: request.signedCookies ? request.signedCookies[nconf.get('sessionKey')] : null,
		request: request,
	});

	const sessionData = await db.sessionStoreGet(sessionId);
	request.session = sessionData;
	let uid = 0;
	if (sessionData && sessionData.passport && sessionData.passport.user) {
		uid = parseInt(sessionData.passport.user, 10);
	}
	request.uid = uid;
	callback(null, uid);
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

// works across multiple nodes
Sockets.getUidsInRoom = async function (room) {
	if (!Sockets.server) {
		return [];
	}
	const ioRoom = Sockets.server.in(room);
	const uids = [];
	if (ioRoom) {
		const sockets = await ioRoom.fetchSockets();
		for (const s of sockets) {
			if (s && s.data && s.data.uid > 0) {
				uids.push(s.data.uid);
			}
		}
	}
	return _.uniq(uids);
};

Sockets.warnDeprecated = (socket, replacement) => {
	if (socket.previousEvents && socket.emit) {
		socket.emit('event:deprecated_call', {
			eventName: socket.previousEvents[socket.previousEvents.length - 1],
			replacement: replacement,
		});
	}
	winston.warn([
		'[deprecated]',
		`${new Error('-').stack.split('\n').slice(2, 5).join('\n')}`,
		`      ${replacement ? `use ${replacement}` : 'there is no replacement for this call.'}`,
	].join('\n'));
};
