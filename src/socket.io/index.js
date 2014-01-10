var	SocketIO = require('socket.io'),
	socketioWildcard = require('socket.io-wildcard'),
	util = require('util'),
	async = require('async'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),
	socketCookieParser = express.cookieParser(nconf.get('secret')),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),

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

				socket.leave(roomName);

				if (rooms[roomName][socket.id]) {
					delete rooms[roomName][socket.id];
				}

				updateRoomBrowsingText(roomName);
			}
		});

		socket.on('reconnected', function() {
			if (uid) {
				topics.pushUnreadCount(uid);
				user.pushNotifCount(uid);
			}

			if (process.env.NODE_ENV === 'development') {
				if (uid) {
					winston.info('[socket] uid ' + uid + ' (' + sessionID + ') has successfully reconnected.');
				} else {
					winston.info('[socket] An anonymous user (' + sessionID + ') has successfully reconnected.');
				}
			}
		});

		socket.on('*', function(payload) {
			// Ignore all non-api messages
			if (payload.name.substr(0, 4) !== 'api:') {
				return;
			} else {
				// Deconstruct the message
				var parts = payload.name.split('.'),
					namespace = parts[0],
					command = parts[1],
					subcommand = parts[2],	// MUST ADD RECURSION (:P)
					executeHandler = function(args) {
						if (!subcommand) {
							Namespaces[namespace][command](args);
						} else {
							Namespaces[namespace][command][subcommand](args);
						}
					};

				if (Namespaces[namespace]) {
					executeHandler(payload.args);
				} else {
					fs.exists(path.join(__dirname, namespace + '.js'), function(exists) {
						if (exists) {
							Namespaces[namespace] = require('./' + namespace);
							executeHandler(payload.args);
						} else {
							winston.warn('[socket.io] Unrecognized message: ' + payload.name);
						}
					})
				}
			}
			console.log('message!', arguments);
		});
	});
}

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
}

Sockets.emitUserCount = function() {
	db.getObjectField('global', 'userCount', function(err, count) {
		io.sockets.emit('user.count', {
			count: count
		});
	});
};

Sockets.in = function(room) {
	return io.sockets.in(room);
};

Sockets.getConnectedClients = function() {
	return userSockets;
}

Sockets.getOnlineAnonCount = function () {
	return userSockets[0] ? userSockets[0].length : 0;
};

/* Helpers */

function isUserOnline(uid) {
	return !!userSockets[uid] && userSockets[uid].length > 0;
}
Sockets.isUserOnline = isUserOnline;

function updateRoomBrowsingText(roomName) {

	function getUidsInRoom(room) {
		var uids = [];
		for (var socketId in room) {
			if (uids.indexOf(room[socketId]) === -1)
				uids.push(room[socketId]);
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
			if(!err)
				io.sockets.in(roomName).emit('api:get_users_in_room', { users: users, anonymousCount: anonymousCount });
		});
	}
}

function emitTopicPostStats() {
	db.getObjectFields('global', ['topicCount', 'postCount'], function(err, data) {
		if (err) {
			return winston.err(err);
		}

		var stats = {
			topics: data.topicCount ? data.topicCount : 0,
			posts: data.postCount ? data.postCount : 0
		};

		io.sockets.emit('post.stats', stats);
	});
}

function emitOnlineUserCount() {
	var anon = userSockets[0] ? userSockets[0].length : 0;
	var registered = Object.keys(userSockets).length;
	if (anon)
		registered = registered - 1;

	var returnObj = {
		users: registered + anon,
		anon: anon
	};
	io.sockets.emit('api:user.active.get', returnObj)
}

function emitAlert(socket, title, message) {
	socket.emit('event:alert', {
		type: 'danger',
		timeout: 2000,
		title: title,
		message: message,
		alert_id: 'post_error'
	});
}

function emitContentTooShortAlert(socket) {
	socket.emit('event:alert', {
		type: 'danger',
		timeout: 2000,
		title: 'Content too short',
		message: "Please enter a longer post. At least " + meta.config.minimumPostLength + " characters.",
		alert_id: 'post_error'
	});
}

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