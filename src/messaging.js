'use strict';


var async = require('async');
var validator = require('validator');

var db = require('./database');
var user = require('./user');
var plugins = require('./plugins');
var meta = require('./meta');
var utils = require('./utils');

var Messaging = module.exports;

require('./messaging/data')(Messaging);
require('./messaging/create')(Messaging);
require('./messaging/delete')(Messaging);
require('./messaging/edit')(Messaging);
require('./messaging/rooms')(Messaging);
require('./messaging/unread')(Messaging);
require('./messaging/notifications')(Messaging);


Messaging.getMessages = function (params, callback) {
	var uid = params.uid;
	var roomId = params.roomId;
	var isNew = params.isNew || false;
	var start = params.hasOwnProperty('start') ? params.start : 0;
	var stop = parseInt(start, 10) + ((params.count || 50) - 1);

	var indices = {};
	async.waterfall([
		function (next) {
			canGet('filter:messaging.canGetMessages', params.callerUid, params.uid, next);
		},
		function (canGet, next) {
			if (!canGet) {
				return callback(null, null);
			}
			db.getSortedSetRevRange('uid:' + uid + ':chat:room:' + roomId + ':mids', start, stop, next);
		},
		function (mids, next) {
			if (!mids.length) {
				return callback(null, []);
			}

			mids.forEach(function (mid, index) {
				indices[mid] = start + index;
			});

			mids.reverse();

			Messaging.getMessagesData(mids, uid, roomId, isNew, next);
		},
		function (messageData, next) {
			messageData.forEach(function (messageData) {
				messageData.index = indices[messageData.messageId.toString()];
			});

			// Filter out deleted messages unless you're the sender of said message
			messageData = messageData.filter(function (messageData) {
				return (!messageData.deleted || parseInt(messageData.fromuid, 10) === parseInt(params.uid, 10));
			});

			next(null, messageData);
		},
	], callback);
};

function canGet(hook, callerUid, uid, callback) {
	plugins.fireHook(hook, {
		callerUid: callerUid,
		uid: uid,
		canGet: parseInt(callerUid, 10) === parseInt(uid, 10),
	}, function (err, data) {
		callback(err, data ? data.canGet : false);
	});
}

Messaging.parse = function (message, fromuid, uid, roomId, isNew, callback) {
	plugins.fireHook('filter:parse.raw', message, function (err, parsed) {
		if (err) {
			return callback(err);
		}

		var messageData = {
			message: message,
			parsed: parsed,
			fromuid: fromuid,
			uid: uid,
			roomId: roomId,
			isNew: isNew,
			parsedMessage: parsed,
		};

		plugins.fireHook('filter:messaging.parse', messageData, function (err, messageData) {
			callback(err, messageData ? messageData.parsedMessage : '');
		});
	});
};

Messaging.isNewSet = function (uid, roomId, timestamp, callback) {
	var setKey = 'uid:' + uid + ':chat:room:' + roomId + ':mids';

	async.waterfall([
		function (next) {
			db.getSortedSetRevRangeWithScores(setKey, 0, 0, next);
		},
		function (messages, next) {
			if (messages && messages.length) {
				next(null, parseInt(timestamp, 10) > parseInt(messages[0].score, 10) + Messaging.newMessageCutoff);
			} else {
				next(null, true);
			}
		},
	], callback);
};


Messaging.getRecentChats = function (callerUid, uid, start, stop, callback) {
	async.waterfall([
		function (next) {
			canGet('filter:messaging.canGetRecentChats', callerUid, uid, next);
		},
		function (canGet, next) {
			if (!canGet) {
				return callback(null, null);
			}
			db.getSortedSetRevRange('uid:' + uid + ':chat:rooms', start, stop, next);
		},
		function (roomIds, next) {
			async.parallel({
				roomData: function (next) {
					Messaging.getRoomsData(roomIds, next);
				},
				unread: function (next) {
					db.isSortedSetMembers('uid:' + uid + ':chat:rooms:unread', roomIds, next);
				},
				users: function (next) {
					async.map(roomIds, function (roomId, next) {
						db.getSortedSetRevRange('chat:room:' + roomId + ':uids', 0, 9, function (err, uids) {
							if (err) {
								return next(err);
							}
							uids = uids.filter(function (value) {
								return value && parseInt(value, 10) !== parseInt(uid, 10);
							});
							user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline'], next);
						});
					}, next);
				},
				teasers: function (next) {
					async.map(roomIds, function (roomId, next) {
						Messaging.getTeaser(uid, roomId, next);
					}, next);
				},
			}, next);
		},
		function (results, next) {
			results.roomData.forEach(function (room, index) {
				if (room) {
					room.users = results.users[index];
					room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : room.users.length > 2;
					room.unread = results.unread[index];
					room.teaser = results.teasers[index];

					room.users.forEach(function (userData) {
						if (userData && parseInt(userData.uid, 10)) {
							userData.status = user.getStatus(userData);
						}
					});
					room.users = room.users.filter(function (user) {
						return user && parseInt(user.uid, 10);
					});
					room.lastUser = room.users[0];

					room.usernames = Messaging.generateUsernames(room.users, uid);
				}
			});

			results.roomData = results.roomData.filter(Boolean);

			next(null, { rooms: results.roomData, nextStart: stop + 1 });
		},
		function (ref, next) {
			plugins.fireHook('filter:messaging.getRecentChats', {
				rooms: ref.rooms,
				nextStart: ref.nextStart,
				uid: uid,
				callerUid: callerUid,
			}, next);
		},
	], callback);
};

Messaging.generateUsernames = function (users, excludeUid) {
	users = users.filter(function (user) {
		return user && parseInt(user.uid, 10) !== excludeUid;
	});
	return users.map(function (user) {
		return user.username;
	}).join(', ');
};

Messaging.getTeaser = function (uid, roomId, callback) {
	var teaser;
	async.waterfall([
		function (next) {
			db.getSortedSetRevRange('uid:' + uid + ':chat:room:' + roomId + ':mids', 0, 0, next);
		},
		function (mids, next) {
			if (!mids || !mids.length) {
				return next(null, null);
			}
			Messaging.getMessageFields(mids[0], ['fromuid', 'content', 'timestamp'], next);
		},
		function (teaser, next) {
			if (!teaser) {
				return callback();
			}
			user.blocks.is(teaser.fromuid, uid, function (err, blocked) {
				if (err || blocked) {
					return callback(err);
				}

				next(null, teaser);
			});
		},
		function (_teaser, next) {
			teaser = _teaser;
			if (!teaser) {
				return callback();
			}
			if (teaser.content) {
				teaser.content = utils.stripHTMLTags(utils.decodeHTMLEntities(teaser.content));
				teaser.content = validator.escape(String(teaser.content));
			}

			teaser.timestampISO = utils.toISOString(teaser.timestamp);
			user.getUserFields(teaser.fromuid, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline'], next);
		},
		function (user, next) {
			teaser.user = user;
			plugins.fireHook('filter:messaging.getTeaser', { teaser: teaser }, function (err, data) {
				next(err, data.teaser);
			});
		},
	], callback);
};

Messaging.canMessageUser = function (uid, toUid, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1 || !uid || uid === toUid) {
		return callback(new Error('[[error:chat-disabled]]'));
	}

	if (parseInt(uid, 10) === parseInt(toUid, 10)) {
		return callback(new Error('[[error:cant-chat-with-yourself'));
	}

	async.waterfall([
		function (next) {
			user.exists(toUid, next);
		},
		function (exists, next) {
			if (!exists) {
				return callback(new Error('[[error:no-user]]'));
			}
			user.getUserFields(uid, ['banned', 'email:confirmed'], next);
		},
		function (userData, next) {
			if (parseInt(userData.banned, 10) === 1) {
				return callback(new Error('[[error:user-banned]]'));
			}

			if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
				return callback(new Error('[[error:email-not-confirmed-chat]]'));
			}

			async.parallel({
				settings: async.apply(user.getSettings, toUid),
				isAdmin: async.apply(user.isAdministrator, uid),
				isModerator: async.apply(user.isModeratorOfAnyCategory, uid),
				isFollowing: async.apply(user.isFollowing, toUid, uid),
			}, next);
		},
		function (results, next) {
			if (results.settings.restrictChat && !results.isAdmin && !results.isModerator && !results.isFollowing) {
				return next(new Error('[[error:chat-restricted]]'));
			}

			plugins.fireHook('static:messaging.canMessageUser', {
				uid: uid,
				toUid: toUid,
			}, function (err) {
				next(err);
			});
		},
	], callback);
};

Messaging.canMessageRoom = function (uid, roomId, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1 || !uid) {
		return callback(new Error('[[error:chat-disabled]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.isUserInRoom(uid, roomId, next);
		},
		function (inRoom, next) {
			if (!inRoom) {
				return next(new Error('[[error:not-in-room]]'));
			}

			Messaging.getUserCountInRoom(roomId, next);
		},
		function (count, next) {
			if (count < 2) {
				return next(new Error('[[error:no-users-in-room]]'));
			}

			user.getUserFields(uid, ['banned', 'email:confirmed'], next);
		},
		function (userData, next) {
			if (parseInt(userData.banned, 10) === 1) {
				return next(new Error('[[error:user-banned]]'));
			}

			if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
				return next(new Error('[[error:email-not-confirmed-chat]]'));
			}

			plugins.fireHook('static:messaging.canMessageRoom', {
				uid: uid,
				roomId: roomId,
			}, function (err) {
				next(err);
			});
		},
	], callback);
};

Messaging.hasPrivateChat = function (uid, withUid, callback) {
	if (parseInt(uid, 10) === parseInt(withUid, 10)) {
		return callback(null, 0);
	}
	async.waterfall([
		function (next) {
			async.parallel({
				myRooms: async.apply(db.getSortedSetRevRange, 'uid:' + uid + ':chat:rooms', 0, -1),
				theirRooms: async.apply(db.getSortedSetRevRange, 'uid:' + withUid + ':chat:rooms', 0, -1),
			}, next);
		},
		function (results, next) {
			var roomIds = results.myRooms.filter(function (roomId) {
				return roomId && results.theirRooms.indexOf(roomId) !== -1;
			});

			if (!roomIds.length) {
				return callback();
			}

			var index = 0;
			var roomId = 0;
			async.whilst(function () {
				return index < roomIds.length && !roomId;
			}, function (next) {
				Messaging.getUserCountInRoom(roomIds[index], function (err, count) {
					if (err) {
						return next(err);
					}
					if (count === 2) {
						roomId = roomIds[index];
						next(null, roomId);
					} else {
						index += 1;
						next();
					}
				});
			}, function (err) {
				next(err, roomId);
			});
		},
	], callback);
};

Messaging.async = require('./promisify')(Messaging);
