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
	socketUser = require('./user'),
	topics = require('../topics'),
	logger = require('../logger'),
	meta = require('../meta'),

	Sockets = {},
	Namespaces = {};

/* === */


var	io;

var onlineUsersMap = {};
var onlineUsers = [];
var uidToSocketId = {};
var socketIdToUid = {};

process.on('message', function(msg) {
	if (typeof msg !== 'object') {
		return;
	}

	if (msg.action === 'user:connect') {
		if (!onlineUsersMap[msg.uid]) {
			onlineUsersMap[msg.uid] = 1;
		} else {
			onlineUsersMap[msg.uid]++;
		}
		if (msg.uid && onlineUsers.indexOf(msg.uid) === -1) {
			onlineUsers.push(msg.uid);
		}

		if (Array.isArray(uidToSocketId[msg.uid])) {
			uidToSocketId[msg.uid].push(msg.socketid);
		} else {
			uidToSocketId[msg.uid] = [msg.socketid];
		}
		socketIdToUid[msg.socketid] = msg.uid;
	} else if(msg.action === 'user:disconnect') {
		var index = onlineUsers.indexOf(msg.uid);
		if (index !== -1) {
			onlineUsers.splice(index, 1);
		}

		if (onlineUsersMap[msg.uid]) {
			onlineUsersMap[msg.uid] -= 1;
			onlineUsersMap[msg.uid] = Math.max(0, onlineUsersMap[msg.uid]);
		}

		if (uidToSocketId[msg.uid]) {
			index = uidToSocketId[msg.uid].indexOf(msg.socketid);
			if (index !== -1) {
				uidToSocketId[msg.uid].splice(index, 1);
			}
		}
		delete socketIdToUid[msg.socketid];
	}
});


Sockets.init = function(server) {
	 var RedisStore = require('socket.io/lib/stores/redis'),
		redis = require('redis'),
		pub = redis.createClient(),
		sub = redis.createClient(),
		client = redis.createClient();

	io = socketioWildcard(SocketIO).listen(server, {
		log: false,
		transports: ['websocket', 'xhr-polling', 'jsonp-polling', 'flashsocket'],
		'browser client minification': true,
		resource: nconf.get('relative_path') + '/socket.io',
		'store' : new RedisStore({
				redisPub : pub,
				redisSub : sub,
				redisClient : client
		}),
	});

	Sockets.server = io;

	db.delete('users:online');

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

		// Validate the session, if present
		socketCookieParser(hs, {}, function(err) {
			if(err) {
				winston.error(err.message);
			}

			sessionID = socket.handshake.signedCookies['express.sid'];
			db.sessionStore.get(sessionID, function(err, sessionData) {
				if (!err && sessionData && sessionData.passport && sessionData.passport.user) {
					uid = parseInt(sessionData.passport.user, 10);
				} else {
					uid = 0;
				}

				socket.uid = parseInt(uid, 10);
				if (process.send) {
					process.send({action: 'user:connect', uid: uid, socketid: socket.id});
				}
				/* If meta.config.loggerIOStatus > 0, logger.io_one will hook into this socket */
				logger.io_one(socket, uid);

				if (uid) {

					db.sortedSetAdd('users:online', Date.now(), uid, function(err) {
						socket.join('uid_' + uid);

						async.parallel({
							user: function(next) {
								user.getUserFields(uid, ['username', 'userslug'], next);
							},
							isAdmin: function(next) {
								user.isAdministrator(uid, next);
							}
						}, function(err, userData) {
							socket.emit('event:connect', {
								status: 1,
								username: userData.user ? userData.user.username : 'guest',
								userslug: userData.user ? userData.user.userslug : '',
								isAdmin: userData.isAdmin,
								uid: uid
							});

							socketUser.isOnline(socket, uid, function(err, data) {
								socket.broadcast.emit('user.isOnline', err, data);
							});
						});
					});
				} else {
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

			if (uid && (!onlineUsersMap[uid] || onlineUsersMap[uid] <= 1)) {
				db.sortedSetRemove('users:online', uid, function(err) {
					socketUser.isOnline(socket, uid, function(err, data) {
						socket.broadcast.emit('user.isOnline', err, data);
					});
				});
			}

			if (process.send) {
				process.send({action: 'user:disconnect', uid: uid, socketid: socket.id});
			}

			emitOnlineUserCount();

			for(var roomName in io.sockets.manager.roomClients[socket.id]) {
				updateRoomBrowsingText(roomName.slice(1));
			}
		});

		socket.on('*', function(payload, callback) {

			function callMethod(method) {
				method.call(null, socket, payload.args.length ? payload.args[0] : null, function(err, result) {
					if (callback) {
						callback(err?{message:err.message}:null, result);
					}
				});
			}

			if(!payload.name) {
				return winston.warn('[socket.io] Empty method name');
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
				return winston.warn('[socket.io] Unrecognized message: ' + payload.name);
			}

			if (Namespaces[namespace].before) {
				Namespaces[namespace].before(socket, payload.name, function() {
					callMethod(methodToCall);
				});
			} else {
				callMethod(methodToCall);
			}
		});
	});
};

Sockets.logoutUser = function(uid) {
	Sockets.getUserSockets(uid).forEach(function(socket) {
		if (socket.handshake && socket.handshake.signedCookies && socket.handshake.signedCookies['express.sid']) {
			db.sessionStore.destroy(socket.handshake.signedCookies['express.sid']);
		}

		socket.emit('event:disconnect');
		socket.disconnect();
	});
};

Sockets.emitUserCount = function() {
	user.count(function(err, count) {
		io.sockets.emit('user.count', err ? {message:err.message} : null, count);
	});
};

Sockets.in = function(room) {
	return io.sockets.in(room);
};

Sockets.uidInRoom = function(uid, room) {
	var socketIds = io.sockets.manager.rooms[room];
	if (!Array(socketIds) || !socketIds.length) {
		return false;
	}

	uid = parseInt(uid, 10);

	for (var i=0; i<socketIds.length; ++i) {
		if (socketIdToUid[socketIds[i]] === uid) {
			return true;
		}
	}
	return false;
};

Sockets.getConnectedClients = function() {
	return onlineUsers;
};

Sockets.getOnlineAnonCount = function () {
	var count = parseInt(onlineUsersMap[0], 10);
	return count ? count : 0;
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
	var uidSocketIds = uidToSocketId[uid];
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


/* Helpers */

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

Sockets.isUserOnline = isUserOnline;
function isUserOnline(uid) {
	return !!onlineUsersMap[uid];
}

Sockets.isUsersOnline = function(uids, callback) {
	var data = uids.map(function(uid) {
		return !!onlineUsersMap[uid];
	});

	callback(null, data);
};

Sockets.updateRoomBrowsingText = updateRoomBrowsingText;
function updateRoomBrowsingText(roomName) {

	if (!roomName) {
		return;
	}

	var	uids = Sockets.getUidsInRoom(roomName),
		anonymousCount = Sockets.getAnonCountInRoom(roomName);

	user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture', 'status'], function(err, users) {
		if(!err) {
			users = users.filter(function(user) {
				return user.status !== 'offline';
			});

			io.sockets.in(roomName).emit('event:update_users_in_room', {
				users: users,
				anonymousCount: anonymousCount,
				room: roomName
			});
		}
	});
}

Sockets.getUidsInRoom = function(roomName) {
	var uids = [];
	roomName = roomName ? '/' + roomName : '';
	var socketids = io.sockets.manager.rooms[roomName];
	if (!Array.isArray(socketids)) {
		return [];
	}

	for(var i=0; i<socketids.length; ++i) {
		var uid = socketIdToUid[socketids[i]];
		if (uid && uids.indexOf(uid) === -1) {
			uids.push(uid);
		}
	}

	return uids;
};

Sockets.getAnonCountInRoom = function(roomName) {
	var count = 0;
	roomName = roomName ? '/' + roomName : '';
 	var socketids = io.sockets.manager.rooms[roomName];
	if (!Array.isArray(socketids)) {
		return [];
	}

	for(var i=0; i<socketids.length; ++i) {
		if (socketIdToUid[socketids[i]] === 0) {
			++count;
		}
	}

	return count;
};

Sockets.emitTopicPostStats = emitTopicPostStats;
function emitTopicPostStats(callback) {
	db.getObjectFields('global', ['topicCount', 'postCount'], function(err, data) {
		if (err) {
			return winston.err(err);
		}

		var stats = {
			topics: data.topicCount ? data.topicCount : 0,
			posts: data.postCount ? data.postCount : 0
		};

		if (!callback) {
			io.sockets.emit('meta.getUsageStats', null, stats);
		} else {
			callback(null, stats);
		}
	});
}

Sockets.emitOnlineUserCount = emitOnlineUserCount;
function emitOnlineUserCount(callback) {
	var anon = Sockets.getOnlineAnonCount();
	var registered = Sockets.getConnectedClients().length;

	var returnObj = {
		users: registered + anon,
		anon: anon
	};

	if (callback) {
		callback(null, returnObj);
	} else {
		io.sockets.emit('user.getActiveUsers', null, returnObj);
	}
}



/* Exporting */
module.exports = Sockets;
