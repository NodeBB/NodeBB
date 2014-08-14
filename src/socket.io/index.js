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


Sockets.init = function(server) {
	io = socketioWildcard(SocketIO).listen(server, {
		log: false,
		transports: ['websocket', 'xhr-polling', 'jsonp-polling', 'flashsocket'],
		'browser client minification': true,
		resource: nconf.get('relative_path') + '/socket.io'
	});

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

				/* If meta.config.loggerIOStatus > 0, logger.io_one will hook into this socket */
				logger.io_one(socket, uid);

				if (uid) {

					db.sortedSetAdd('users:online', Date.now(), uid, function(err, data) {
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
								username: userData.user.username,
								userslug: userData.user.userslug,
								isAdmin: userData.isAdmin,
								uid: uid
							});

							socketUser.isOnline(socket, uid, function(err, data) {
								socket.broadcast.emit('user.isOnline', err, data);
							});
						});
					});
				} else {
					socket.broadcast.emit('user.anonConnect');
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

			if (uid && Sockets.getUserSockets(uid).length <= 1) {
				db.sortedSetRemove('users:online', uid, function(err) {
					socketUser.isOnline(socket, uid, function(err, data) {
						socket.broadcast.emit('user.isOnline', err, data);
					});
				});
			}

			if (!uid) {
				socket.broadcast.emit('user.anonDisconnect');
			}

			emitOnlineUserCount();

			for(var roomName in io.sockets.manager.roomClients[socket.id]) {
				updateRoomBrowsingText(roomName.slice(1));
			}
		});

		socket.on('*', function(payload, callback) {

			function callMethod(method) {
				if(socket.uid) {
					user.updateLastOnlineTime(socket.uid);
				}

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
				namespace = parts.slice(0, 1),
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
	var clients = io.sockets.clients(room);

	uid = parseInt(uid, 10);

	if (typeof uid === 'number' && uid > 0) {
		clients = clients.filter(function(socketObj) {
			return uid === socketObj.uid;
		});

		return clients.length ? true : false;
	} else {
		return false;
	}
};

Sockets.getConnectedClients = function() {
	var uids = [];
	if (!io) {
		return uids;
	}
	var clients = io.sockets.clients();

	clients.forEach(function(client) {
		if(client.uid && uids.indexOf(client.uid) === -1) {
			uids.push(client.uid);
		}
	});
	return uids;
};

Sockets.getOnlineAnonCount = function () {
	return Sockets.getUserSockets(0).length;
};

Sockets.getUserSockets = function(uid) {
	var sockets = io.sockets.clients();
	if(!sockets || !sockets.length) {
		return [];
	}

	sockets = sockets.filter(function(s) {
		return s.uid === parseInt(uid, 10);
	});

	return sockets;
};

Sockets.getUserRooms = function(uid) {
	var sockets = Sockets.getUserSockets(uid);
	var rooms = {};
	for (var i=0; i<sockets.length; ++i) {
		var roomClients = io.sockets.manager.roomClients[sockets[i].id];
		for (var roomName in roomClients) {
			rooms[roomName.slice(1)] = true;
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
	return Sockets.getUserSockets(uid).length > 0;
}

Sockets.updateRoomBrowsingText = updateRoomBrowsingText;
function updateRoomBrowsingText(roomName) {

	if (!roomName) {
		return;
	}

	function getAnonymousCount() {
		var clients = io.sockets.clients(roomName);
		var anonCount = 0;

		for (var i = 0; i < clients.length; ++i) {
			if(clients[i].uid === 0) {
				++anonCount;
			}
		}
		return anonCount;
	}

	var	uids = Sockets.getUidsInRoom(roomName),
		anonymousCount = getAnonymousCount();

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
	var clients = io.sockets.clients(roomName);
	for(var i=0; i<clients.length; ++i) {
		if (uids.indexOf(clients[i].uid) === -1 && clients[i].uid !== 0) {
			uids.push(clients[i].uid);
		}
	}
	return uids;
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
	var anon = Sockets.getOnlineAnonCount(0);
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
