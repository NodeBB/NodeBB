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
			lib = lib.slice(0, -3);
			Namespaces[lib] = require('./' + lib);
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

			sessionID = socket.handshake.signedCookies["express.sid"];
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
							username: function(next) {
								user.getUserField(uid, 'username', next);
							},
							isAdmin: function(next) {
								user.isAdministrator(uid, next);
							}
						}, function(err, userData) {
							socket.emit('event:connect', {
								status: 1,
								username: userData.username,
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
						username: 'Anonymous',
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
				Namespaces[namespace].before(socket, function() {
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

Sockets.getConnectedClients = function() {
	var clients = io.sockets.clients();
	var uids = [];
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

/* Helpers */

Sockets.isUserOnline = isUserOnline;
function isUserOnline(uid) {
	return Sockets.getUserSockets(uid).length > 0;
}

Sockets.updateRoomBrowsingText = updateRoomBrowsingText;
function updateRoomBrowsingText(roomName) {

	if (!roomName) {
		return;
	}

	function getUidsInRoom() {
		var uids = [];
		var clients = io.sockets.clients(roomName);
		for(var i=0; i<clients.length; ++i) {
			if (uids.indexOf(clients[i].uid) === -1 && clients[i].uid !== 0) {
				uids.push(clients[i].uid);
			}
		}
		return uids;
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

	var	uids = getUidsInRoom(),
		anonymousCount = getAnonymousCount();



	user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture', 'status'], function(err, users) {
		if(!err) {
			users = users.filter(function(user) {
				return user.status !== 'offline';
			});

			io.sockets.in(roomName).emit('get_users_in_room', {
				users: users,
				anonymousCount: anonymousCount,
				room: roomName
			});
		}
	});
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