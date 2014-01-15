"use strict";

var	SocketIO = require('socket.io'),
	socketioWildcard = require('socket.io-wildcard'),
	util = require('util'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),
	socketCookieParser = express.cookieParser(nconf.get('secret')),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),
	meta = require('../meta'),

	Sockets = {},
	Namespaces = {};

/* === */

var users = {},
	userSockets = {},
	rooms = {},
	io;

Sockets.init = function() {

	io = socketioWildcard(SocketIO).listen(global.server, {
		log: false,
		transports: ['websocket', 'xhr-polling', 'jsonp-polling', 'flashsocket'],
		'browser client minification': true
	});

	fs.readdir(__dirname, function(err, files) {
		files.splice(files.indexOf('index.js'), 1);

		async.each(files, function(lib, next) {
			lib = lib.slice(0, -3);
			Namespaces[lib] = require('./' + lib);
			next();
		});
	});

	io.sockets.on('connection', function(socket) {
		var hs = socket.handshake,
			sessionID, uid, lastPostTime = 0;

		// Validate the session, if present
		socketCookieParser(hs, {}, function(err) {
			sessionID = socket.handshake.signedCookies["express.sid"];
			db.sessionStore.get(sessionID, function(err, sessionData) {
				if (!err && sessionData && sessionData.passport && sessionData.passport.user) {
					uid = users[sessionID] = sessionData.passport.user;
				} else {
					uid = users[sessionID] = 0;
				}

				userSockets[uid] = userSockets[uid] || [];
				userSockets[uid].push(socket);

				/* Need to save some state for the logger & maybe some other modules later on */
				socket.state = {
					user : {
						uid : uid
					}
				};

				/* If meta.config.loggerIOStatus > 0, logger.io_one will hook into this socket */
				logger.io_one(socket,uid);

				if (uid) {

					db.sortedSetAdd('users:online', Date.now(), uid, function(err, data) {
						socket.join('uid_' + uid);

						user.getUserField(uid, 'username', function(err, username) {
							socket.emit('event:connect', {
								status: 1,
								username: username,
								uid: uid
							});
						});
					});
				}

				io.sockets.in('global').emit('api:user.isOnline', isUserOnline(uid));
			});
		});

		socket.on('disconnect', function() {

			var index = (userSockets[uid] || []).indexOf(socket);
			if (index !== -1) {
				userSockets[uid].splice(index, 1);
			}

			if (userSockets[uid] && userSockets[uid].length === 0) {
				delete users[sessionID];
				delete userSockets[uid];
				if (uid) {
					db.sortedSetRemove('users:online', uid, function(err, data) {
					});
				}
			}

			io.sockets.in('global').emit('api:user.isOnline', isUserOnline(uid));

			emitOnlineUserCount();

			for (var roomName in rooms) {
				if (rooms.hasOwnProperty(roomName)) {
					socket.leave(roomName);

					if (rooms[roomName][socket.id]) {
						delete rooms[roomName][socket.id];
					}

					updateRoomBrowsingText(roomName);
				}
			}
		});

		socket.on('*', function(payload, callback) {
			// Ignore all non-api messages
			if (payload.name.substr(0, 4) !== 'api:') {
				return;
			} else {
				// Deconstruct the message
				var parts = payload.name.slice(4).split('.'),
					namespace = parts.slice(0, 1),
					methodToCall = parts.reduce(function(prev, cur) {
						if (prev !== null && prev[cur]) {
							return prev[cur];
						} else {
							return null;
						}
					}, Namespaces);

				if (methodToCall !== null) {
					var	sessionData = {
							uid: uid,
							socket: socket,
							rooms: rooms,
							server: io,
							userSockets: userSockets
						},
						socketArgs = [];

					// Construct the arguments that'll get passed into each socket method
					if (payload.args.length) {
						socketArgs = socketArgs.concat(payload.args);
					}
					if (callback !== undefined) {
						socketArgs.push(callback);
					}
					socketArgs.push(sessionData);

					// Call the requested method
					if (Namespaces[namespace].before) {
						Namespaces[namespace].before(sessionData, function() {
							try {
								methodToCall.apply(Namespaces, socketArgs);
							} catch (e) {
								winston.error(e.message);
							}
						});
					} else {
						try {
							methodToCall.apply(Namespaces, socketArgs);
						} catch (e) {
							winston.error(e.message);
						}
					}
					// winston.info('[socket.io] Executing: ' + payload.name);
				} else {
					winston.warn('[socket.io] Unrecognized message: ' + payload.name);
				}
			}
		});
	});
};

Sockets.logoutUser = function(uid) {
	if(userSockets[uid] && userSockets[uid].length) {
		for(var i=0; i< userSockets[uid].length; ++i) {
			userSockets[uid][i].emit('event:disconnect');
			userSockets[uid][i].disconnect();

			if(!userSockets[uid]) {
				return;
			}
		}
	}
};

Sockets.emitUserCount = function() {
	db.getObjectField('global', 'userCount', function(err, count) {
		io.sockets.emit('user.count', {
			count: count
		});
	});
};

// Use sessionData.server.sockets.in() instead of this method.
Sockets.in = function(room) {
	return io.sockets.in(room);
};

Sockets.getConnectedClients = function() {
	return userSockets;
};

Sockets.getOnlineAnonCount = function () {
	return userSockets[0] ? userSockets[0].length : 0;
};

/* Helpers */

Sockets.isUserOnline = isUserOnline;
function isUserOnline(uid) {
	return !!userSockets[uid] && userSockets[uid].length > 0;
}

Sockets.updateRoomBrowsingText = updateRoomBrowsingText;
function updateRoomBrowsingText(roomName) {

	function getUidsInRoom(room) {
		var uids = [];
		for (var socketId in room) {
			if (uids.indexOf(room[socketId]) === -1) {
				uids.push(room[socketId]);
			}
		}
		return uids;
	}

	function getAnonymousCount(roomName) {
		var clients = io.sockets.clients(roomName);
		var anonCount = 0;

		for (var i = 0; i < clients.length; ++i) {
			var hs = clients[i].handshake;
			if (hs && clients[i].state && clients[i].state.user.uid === 0) {
				++anonCount;
			}
		}
		return anonCount;
	}

	var	uids = getUidsInRoom(rooms[roomName]),
		anonymousCount = getAnonymousCount(roomName);

	if (uids.length === 0) {
		io.sockets.in(roomName).emit('api:get_users_in_room', { users: [], anonymousCount: anonymousCount });
	} else {
		user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], function(err, users) {
			if(!err) {
				io.sockets.in(roomName).emit('api:get_users_in_room', { users: users, anonymousCount: anonymousCount });
			}
		});
	}
}

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
			io.sockets.emit('post.stats', stats);
		} else {
			callback(stats);
		}
	});
}

Sockets.emitOnlineUserCount = emitOnlineUserCount;
function emitOnlineUserCount(callback) {
	var anon = userSockets[0] ? userSockets[0].length : 0;
	var registered = Object.keys(userSockets).length;
	if (anon) {
		registered = registered - 1;
	}

	var returnObj = {
		users: registered + anon,
		anon: anon
	};

	if (callback) {
		callback(returnObj);
	} else {
		io.sockets.emit('api:user.active.get', returnObj);
	}
}

Sockets.emitAlert = emitAlert;
function emitAlert(socket, title, message) {
	socket.emit('event:alert', {
		type: 'danger',
		timeout: 2000,
		title: title,
		message: message,
		alert_id: 'post_error'
	});
}

Sockets.emitContentTooShortAlert = emitContentTooShortAlert;
function emitContentTooShortAlert(socket) {
	socket.emit('event:alert', {
		type: 'danger',
		timeout: 2000,
		title: 'Content too short',
		message: "Please enter a longer post. At least " + meta.config.minimumPostLength + " characters.",
		alert_id: 'post_error'
	});
}

Sockets.emitTooManyPostsAlert = emitTooManyPostsAlert;
function emitTooManyPostsAlert(socket) {
	socket.emit('event:alert', {
		title: 'Too many posts!',
		message: 'You can only post every ' + meta.config.postDelay + ' seconds.',
		type: 'danger',
		timeout: 2000
	});
}

/* Exporting */
module.exports = Sockets;