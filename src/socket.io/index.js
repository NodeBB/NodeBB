"use strict";

var	SocketIO = require('socket.io'),
	socketioWildcard = require('socketio-wildcard')(),
	async = require('async'),
	nconf = require('nconf'),
	cookieParser = require('cookie-parser')(nconf.get('secret')),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	logger = require('../logger'),
	ratelimit = require('../middleware/ratelimit'),
	rooms = require('./rooms'),

	Sockets = {},
	Namespaces = {};

var io;

Sockets.init = function(server) {
	requireModules();

	io = new SocketIO({
		path: nconf.get('relative_path') + '/socket.io'
	});

	addRedisAdapter(io);

	io.use(socketioWildcard);
	io.use(authorize);

	io.on('connection', onConnection);

	io.listen(server, {
		transports: nconf.get('socket.io:transports')
	});

	Sockets.server = io;
};

function onConnection(socket) {
	socket.ip = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;

	logger.io_one(socket, socket.uid);

	onConnect(socket);

	// see https://github.com/Automattic/socket.io/issues/1814 and
	// http://stackoverflow.com/questions/25830415/get-the-list-of-rooms-the-client-is-currently-in-on-disconnect-event
	socket.onclose = function(reason) {
		Object.getPrototypeOf(this).onclose.call(this, {reason: reason, rooms: socket.rooms.slice()});
	};

	socket.on('disconnect', function(data) {
		onDisconnect(socket, data);
	});

	socket.on('*', function(payload) {
		onMessage(socket, payload);
	});
}

function onConnect(socket) {
	if (socket.uid) {
		rooms.enter(socket, 'uid_' + socket.uid);
		rooms.enter(socket, 'online_users');

		user.getUserFields(socket.uid, ['status'], function(err, userData) {
			if (err || !userData) {
				return;
			}

			socket.emit('event:connect');
			if (userData.status !== 'offline') {
				socket.broadcast.emit('event:user_status_change', {uid: socket.uid, status: userData.status || 'online'});
			}
		});
	} else {
		rooms.enter(socket, 'online_guests');
		socket.emit('event:connect');
	}
}

function onDisconnect(socket, data) {
	if (socket.uid) {
		var socketCount = Sockets.getUserSocketCount(socket.uid);
		if (socketCount <= 1) {
			socket.broadcast.emit('event:user_status_change', {uid: socket.uid, status: 'offline'});
		}

		// see https://github.com/Automattic/socket.io/issues/1814
		// data.rooms.forEach(function(roomName) {
		// 	if (roomName.startsWith('topic')) {
		// 		io.in(roomName).emit('event:user_leave', socket.uid);
		// 	}
		// });
	}
	rooms.leaveAll(socket, data.rooms);
}

function onMessage(socket, payload) {
	if (!payload.data.length) {
		return winston.warn('[socket.io] Empty payload');
	}

	var eventName = payload.data[0];
	var params = payload.data[1];
	var callback = typeof payload.data[payload.data.length - 1] === 'function' ? payload.data[payload.data.length - 1] : function() {};

	if (!eventName) {
		return winston.warn('[socket.io] Empty method name');
	}

	var parts = eventName.toString().split('.'),
		namespace = parts[0],
		methodToCall = parts.reduce(function(prev, cur) {
			if (prev !== null && prev[cur]) {
				return prev[cur];
			} else {
				return null;
			}
		}, Namespaces);

	if(!methodToCall) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('[socket.io] Unrecognized message: ' + eventName);
		}
		return;
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

	if (Namespaces[namespace].before) {
		Namespaces[namespace].before(socket, eventName, params, function(err) {
			if (err) {
				return callback({message: err.message});
			}
			callMethod(methodToCall, socket, params, callback);
		});
	} else {
		callMethod(methodToCall, socket, params, callback);
	}
}

function requireModules() {
	var modules = ['admin', 'categories', 'groups', 'meta', 'modules',
		'notifications', 'plugins', 'posts', 'topics', 'user'
	];

	modules.forEach(function(module) {
		Namespaces[module] = require('./' + module);
	});
}

function authorize(socket, callback) {
	var handshake = socket.request;

	if (!handshake) {
		return callback(new Error('[[error:not-authorized]]'));
	}

	async.waterfall([
		function(next) {
			cookieParser(handshake, {}, next);
		},
		function(next) {
			db.sessionStore.get(handshake.signedCookies['express.sid'], function(err, sessionData) {
				if (err) {
					return next(err);
				}
				if (sessionData && sessionData.passport && sessionData.passport.user) {
					socket.uid = parseInt(sessionData.passport.user, 10);
				} else {
					socket.uid = 0;
				}
				next();
			});
		}
	], callback);
}

function addRedisAdapter(io) {
	if (nconf.get('redis')) {
		var redisAdapter = require('socket.io-redis');
		var redis = require('../database/redis');
		var pub = redis.connect({return_buffers: true});
		var sub = redis.connect({return_buffers: true});

		io.adapter(redisAdapter({pubClient: pub, subClient: sub}));
	} else if (nconf.get('isCluster') === 'true') {
		winston.warn('[socket.io] Clustering detected, you are advised to configure Redis as a websocket store.');
	}
}

function callMethod(method, socket, params, callback) {
	method(socket, params, function(err, result) {
		callback(err ? {message: err.message} : null, result);
	});
}

Sockets.logoutUser = function(uid) {
	io.in('uid_' + uid).emit('event:disconnect');
};

Sockets.in = function(room) {
	return io.in(room);
};

Sockets.getSocketCount = function() {
	if (!io) {
		return 0;
	}
	return io.sockets.sockets.length;
};

Sockets.getUserSocketCount = function(uid) {
	if (!io) {
		return 0;
	}
	return io.sockets.adapter.rooms['uid_' + uid] ? Object.keys(io.sockets.adapter.rooms['uid_' + uid]).length : 0;
};

Sockets.getOnlineUserCount = function() {
	if (!io) {
		return 0;
	}

	return io.sockets.adapter.rooms.online_users ? Object.keys(io.sockets.adapter.rooms.online_users).length : 0;
};

Sockets.getOnlineAnonCount = function () {
	if (!io) {
		return 0;
	}
	return io.sockets.adapter.rooms.online_guests ? Object.keys(io.sockets.adapter.rooms.online_guests).length : 0;
};

Sockets.reqFromSocket = function(socket) {
	var headers = socket.request.headers,
		host = headers.host,
		referer = headers.referer || '';

	return {
		ip: headers['x-forwarded-for'] || socket.ip,
		host: host,
		protocol: socket.request.connection.encrypted ? 'https' : 'http',
		secure: !!socket.request.connection.encrypted,
		url: referer,
		path: referer.substr(referer.indexOf(host) + host.length),
		headers: headers
	};
};

Sockets.isUserOnline = function(uid) {
	return !!rooms.clients('uid_' + uid).length;
};

Sockets.isUsersOnline = function(uids, callback) {
	callback(null, uids.map(Sockets.isUserOnline));
};

Sockets.getUsersInRoom = function (uid, roomName, start, stop, callback) {
	callback(null, {
		users: [],
		room: roomName,
		total: 0,
		hidden: 0
	});
	return;

	if (!roomName) {
		return;
	}

	var	uids = Sockets.getUidsInRoom(roomName);
	var total = uids.length;
	if (stop !== -1) {
		uids = uids.slice(start, stop);
	}

	if (uid && uids.indexOf(uid.toString()) === -1) {
		uids = [uid].concat(uids);
	}

	if (!uids.length) {
		return callback(null, {users: [], total: 0 , room: roomName});
	}
	user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status'], function(err, users) {
		if (err) {
			return callback(err);
		}

		users = users.filter(function(user) {
			return user && user.status !== 'offline';
		});

		callback(null, {
			users: users,
			room: roomName,
			total: users.length ? total : 0,
			hidden: Math.max(0, total - uids.length)
		});
	});
};

Sockets.getUidsInRoom = function(roomName, callback) {
	callback = callback || function() {};

	var uids = [];

	var socketids = rooms.clients(roomName);
	if (!Array.isArray(socketids) || !socketids.length) {
		callback(null, []);
		return [];
	}

	for(var i=0; i<socketids.length; ++i) {
		var socketRooms = rooms.clientRooms(socketids[i]);
		if (Array.isArray(socketRooms)) {
			socketRooms.forEach(function(roomName) {
				if (roomName.startsWith('uid_')) {
					var uid = roomName.split('_')[1];
					if (uids.indexOf(uid) === -1) {
						uids.push(uid);
					}
				}
			});
		}
	}

	callback(null, uids);
	return uids;
};


/* Exporting */
module.exports = Sockets;
