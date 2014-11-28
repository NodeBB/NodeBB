"use strict";

var	SocketIO = require('socket.io'),
	socketioWildcard = require('socket.io-wildcard'),
	util = require('util'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	socketCookieParser = require('cookie-parser')(nconf.get('secret')),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),
	ratelimit = require('../middleware/ratelimit'),

	Sockets = {},
	Namespaces = {};

/* === */


var	io;

Sockets.init = function(server) {
	// Default socket.io config
	var config = {
			log: true,
			'log level': process.env.NODE_ENV === 'development' ? 2 : 0,
			transports: ['websocket', 'xhr-polling', 'jsonp-polling', 'flashsocket'],
			'browser client minification': true,
			resource: nconf.get('relative_path') + '/socket.io'
		};

	// If a redis server is configured, use it as a socket.io store, otherwise, fall back to in-memory store
	if (nconf.get('redis')) {
		var RedisStore = require('socket.io/lib/stores/redis'),
			database = require('../database/redis'),
			pub = database.connect(),
			sub = database.connect(),
			client = database.connect();

		// "redis" property needs to be passed in as referenced here: https://github.com/Automattic/socket.io/issues/808
		// Probably fixed in socket.IO 1.0
		config.store = new RedisStore({
			redis: require('redis'),
			redisPub : pub,
			redisSub : sub,
			redisClient : client
		});
	} else if (nconf.get('cluster')) {
		winston.warn('[socket.io] Clustering detected, you are advised to configure Redis as a websocket store.');
	}

	io = socketioWildcard(SocketIO).listen(server, config);

	Sockets.server = io;

	fs.readdir(__dirname, function(err, files) {
		files.splice(files.indexOf('index.js'), 1);

		async.each(files, function(lib, next) {
			if (lib.substr(lib.length - 3) === '.js') {
				lib = lib.slice(0, -3);
				Namespaces[lib] = require('./' + lib);
			}

			next();
		});
	});

	io.sockets.on('connection', function(socket) {
		var hs = socket.handshake,
			sessionID, uid;

		if (!hs) {
			return;
		}

		// Validate the session, if present
		socketCookieParser(hs, {}, function(err) {
			if(err) {
				return winston.error(err.message);
			}

			sessionID = socket.handshake.signedCookies['express.sid'];
			db.sessionStore.get(sessionID, function(err, sessionData) {
				if (!err && sessionData && sessionData.passport && sessionData.passport.user) {
					uid = parseInt(sessionData.passport.user, 10);
				} else {
					uid = 0;
				}

				socket.uid = parseInt(uid, 10);

				/* If meta.config.loggerIOStatus > 0, logger.io_one will hook into this socket */
				logger.io_one(socket, uid);

				if (uid) {
					socket.join('uid_' + uid);
					socket.join('online_users');

					async.parallel({
						user: function(next) {
							user.getUserFields(uid, ['username', 'userslug', 'picture', 'status'], next);
						},
						isAdmin: function(next) {
							user.isAdministrator(uid, next);
						}
					}, function(err, userData) {
						if (err || !userData.user) {
							return;
						}
						socket.emit('event:connect', {
							status: 1,
							username: userData.user.username,
							userslug: userData.user.userslug,
							picture: userData.user.picture,
							isAdmin: userData.isAdmin,
							uid: uid
						});

						socket.broadcast.emit('event:user_status_change', {uid:uid, status: userData.user.status});
					});

				} else {
					socket.join('online_guests');
					socket.emit('event:connect', {
						status: 1,
						username: '[[global:guest]]',
						isAdmin: false,
						uid: 0
					});
				}
			});
		});

		socket.on('disconnect', function() {
			var socketCount = Sockets.getUserSocketCount(uid);
			if (uid && socketCount <= 1) {
				socket.broadcast.emit('event:user_status_change', {uid: uid, status: 'offline'});
			}

			for(var roomName in io.sockets.manager.roomClients[socket.id]) {
				if (roomName.indexOf('topic') !== -1) {
					io.sockets.in(roomName.slice(1)).emit('event:user_leave', socket.uid);
				}
			}
		});

		socket.on('*', function(payload, callback) {
			if (!payload.name) {
				return winston.warn('[socket.io] Empty method name');
			}

			if (ratelimit.isFlooding(socket)) {
				winston.warn('[socket.io] Too many emits! Disconnecting uid : ' + socket.uid + '. Message : ' + payload.name);
				return socket.disconnect();
			}

			var parts = payload.name.toString().split('.'),
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
					winston.warn('[socket.io] Unrecognized message: ' + payload.name);
				}
				return;
			}

			if (Namespaces[namespace].before) {
				Namespaces[namespace].before(socket, payload.name, function() {
					callMethod(methodToCall, socket, payload, callback);
				});
			} else {
				callMethod(methodToCall, socket, payload, callback);
			}
		});
	});
};

function callMethod(method, socket, payload, callback) {
	method.call(null, socket, payload.args.length ? payload.args[0] : null, function(err, result) {
		if (callback) {
			callback(err ? {message: err.message} : null, result);
		}
	});
}

Sockets.logoutUser = function(uid) {
	Sockets.getUserSockets(uid).forEach(function(socket) {
		if (socket.handshake && socket.handshake.signedCookies && socket.handshake.signedCookies['express.sid']) {
			db.sessionStore.destroy(socket.handshake.signedCookies['express.sid']);
		}

		socket.emit('event:disconnect');
		socket.disconnect();
	});
};

Sockets.in = function(room) {
	return io.sockets.in(room);
};

Sockets.uidInRoom = function(uid, room) {
	var userSocketIds = io.sockets.manager.rooms['/uid_' + uid];
	if (!Array.isArray(userSocketIds) || !userSocketIds.length) {
		return false;
	}

	var roomSocketIds = io.sockets.manager.rooms['/' + room];
	if (!Array.isArray(roomSocketIds) || !roomSocketIds.length) {
		return false;
	}

	for (var i=0; i<userSocketIds.length; ++i) {
		if (roomSocketIds.indexOf(userSocketIds[i]) !== -1) {
			return true;
		}
	}
	return false;
};

Sockets.getSocketCount = function() {
	var clients = io.sockets.manager.rooms[''];
	return Array.isArray(clients) ? clients.length : 0;
};

Sockets.getUserSocketCount = function(uid) {
	var roomClients = io.sockets.manager.rooms['/uid_' + uid];
	if(!Array.isArray(roomClients)) {
		return 0;
	}
	return roomClients.length;
};

Sockets.getOnlineAnonCount = function () {
	var guestRoom = io.sockets.manager.rooms['/online_guests'];
	if (!Array.isArray(guestRoom)) {
		return 0;
	}
	return guestRoom.length;
};

Sockets.getUserSockets = function(uid) {
	var sockets = io.sockets.clients();
	if(!sockets || !sockets.length) {
		return [];
	}

	uid = parseInt(uid, 10);

	sockets = sockets.filter(function(s) {
		return s.uid === uid;
	});

	return sockets;
};

Sockets.getUserRooms = function(uid) {
	var rooms = {};
	var uidSocketIds = io.sockets.manager.rooms['/uid_' + uid];
	if (!Array.isArray(uidSocketIds)) {
		return [];
	}
	for (var i=0; i<uidSocketIds.length; ++i) {
		var roomClients = io.sockets.manager.roomClients[uidSocketIds[i]];
	 	for (var roomName in roomClients) {
	 		if (roomName && roomClients.hasOwnProperty(roomName)) {
	 			rooms[roomName.slice(1)] = true;
	 		}
	 	}
	}

	rooms = Object.keys(rooms);
	return rooms;
};

Sockets.reqFromSocket = function(socket) {
	var headers = socket.handshake.headers,
		host = headers.host,
		referer = headers.referer || '';

	return {
		ip: headers['x-forwarded-for'] || (socket.handshake.address || {}).address,
		host: host,
		protocol: headers.secure ? 'https' : 'http',
		secure: !!headers.secure,
		url: referer,
		path: referer.substr(referer.indexOf(host) + host.length),
		headers: headers
	};
};

Sockets.isUserOnline = function(uid) {
	if (!io) {
		// Special handling for install script (socket.io not initialised)
		return false;
	}

	return Array.isArray(io.sockets.manager.rooms['/uid_' + uid]);
};

Sockets.isUsersOnline = function(uids, callback) {
	var data = uids.map(Sockets.isUserOnline);

	callback(null, data);
};

Sockets.updateRoomBrowsingText = function (roomName, selfUid) {
	if (!roomName) {
		return;
	}

	var	uids = Sockets.getUidsInRoom(roomName);
	var total = uids.length;
	uids = uids.slice(0, 9);
	if (selfUid) {
		uids = [selfUid].concat(uids);
	}
	if (!uids.length) {
		return;
	}
	user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture', 'status'], function(err, users) {
		if (err) {
			return;
		}

		users = users.filter(function(user) {
			return user && user.status !== 'offline';
		});

		io.sockets.in(roomName).emit('event:update_users_in_room', {
			users: users,
			room: roomName,
			total: Math.max(0, total - uids.length)
		});
	});
};

Sockets.getUidsInRoom = function(roomName) {
	var uids = [];
	roomName = roomName ? '/' + roomName : '';
	var socketids = io.sockets.manager.rooms[roomName];
	if (!Array.isArray(socketids)) {
		return [];
	}

	for(var i=0; i<socketids.length; ++i) {
		var socketRooms = Object.keys(io.sockets.manager.roomClients[socketids[i]]);
		if (Array.isArray(socketRooms)) {
			socketRooms.forEach(function(roomName) {
				if (roomName.indexOf('/uid_') === 0 ) {
					uids.push(roomName.split('_')[1]);
				}
			});
		}
	}

	return uids;
};


/* Exporting */
module.exports = Sockets;
