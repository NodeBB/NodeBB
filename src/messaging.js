'use strict';

var db = require('./database'),
	async = require('async'),
	user = require('./user'),
	plugins = require('./plugins'),
	meta = require('./meta');


(function(Messaging) {

	function sortUids(fromuid, touid) {
		return [fromuid, touid].sort();
	}

	Messaging.addMessage = function(fromuid, touid, content, callback) {
		var uids = sortUids(fromuid, touid);

		db.incrObjectField('global', 'nextMid', function(err, mid) {
			if (err) {
				return callback(err);
			}

			var message = {
				content: content,
				timestamp: Date.now(),
				fromuid: fromuid,
				touid: touid
			};

			plugins.fireHook('filter:messaging.save', message, function(err, message) {
				if (err) {
					return callback(err);
				}

				db.setObject('message:' + mid, message, function(err) {
					if (err) {
						return callback(err);
					}

					db.listAppend('messages:' + uids[0] + ':' + uids[1], mid);

					Messaging.updateChatTime(fromuid, touid);
					Messaging.updateChatTime(touid, fromuid);

					async.parallel([
						function(next) {
							Messaging.markRead(fromuid, touid, next);
						},
						function(next) {
							Messaging.markUnread(touid, fromuid, next);
						}
					], function(err, results) {
						if (err) {
							return callback(err);
						}

						getMessages([mid], fromuid, touid, true, function(err, messages) {
							callback(err, messages ? messages[0] : null);
						});
					});
				});
			});
		});
	};

	Messaging.getMessages = function(fromuid, touid, isNew, callback) {
		var uids = sortUids(fromuid, touid);

		db.getListRange('messages:' + uids[0] + ':' + uids[1], -((meta.config.chatMessagesToDisplay || 50) - 1), -1, function(err, mids) {
			if (err) {
				return callback(err);
			}

			if (!mids || !mids.length) {
				return callback(null, []);
			}

			getMessages(mids, fromuid, touid, isNew, callback);
		});
	};

	function getMessages(mids, fromuid, touid, isNew, callback) {
		user.getMultipleUserFields([fromuid, touid], ['uid', 'username', 'userslug', 'picture'], function(err, userData) {
			if(err) {
				return callback(err);
			}

			var keys = mids.map(function(mid) {
				return 'message:' + mid;
			});

			db.getObjects(keys, function(err, messages) {
				if (err) {
					return callback(err);
				}

				async.map(messages, function(message, next) {
					var self = parseInt(message.fromuid, 10) === parseInt(fromuid, 10);
					message.fromUser = self ? userData[0] : userData[1];
					message.toUser = self ? userData[1] : userData[0];
					message.timestampISO = new Date(parseInt(message.timestamp, 10)).toISOString();
					message.self = self ? 1 : 0;

					Messaging.parse(message.content, message.fromuid, fromuid, userData[1], userData[0], isNew, function(result) {
						message.content = result;
						next(null, message);
					});
				}, callback);
			});
		});
	}

	Messaging.parse = function (message, fromuid, myuid, toUserData, myUserData, isNew, callback) {
		plugins.fireHook('filter:post.parse', message, function(err, parsed) {
			if (err) {
				return callback(message);
			}

			var messageData = {
				message: message,
				parsed: parsed,
				fromuid: fromuid,
				myuid: myuid,
				toUserData: toUserData,
				myUserData: myUserData,
				isNew: isNew,
				parsedMessage: parsed
			};

			plugins.fireHook('filter:messaging.parse', messageData, function(err, messageData) {
				callback(messageData.parsedMessage);
			});
		});
	};

	Messaging.updateChatTime = function(uid, toUid, callback) {
		callback = callback || function() {};
		db.sortedSetAdd('uid:' + uid + ':chats', Date.now(), toUid, callback);
	};

	Messaging.getRecentChats = function(uid, start, end, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':chats', start, end, function(err, uids) {
			if(err) {
				return callback(err);
			}

			user.getMultipleUserFields(uids, ['username', 'picture', 'uid'], function(err, users) {
				if (err) {
					return callback(err);
				}

				users = users.filter(function(user) {
					return !!user.uid;
				});

				async.map(users, function(userData, next) {
					user.isOnline(userData.uid, function(err, data) {
						if (err) {
							return next(err);
						}
						userData.status = data.status;
						next(null, userData);
					});
				}, callback);
			});
		});
	};

	Messaging.getUnreadCount = function(uid, callback) {
		db.sortedSetCard('uid:' + uid + ':chats:unread', callback);
	};

	Messaging.markRead = function(uid, toUid, callback) {
		db.sortedSetRemove('uid:' + uid + ':chats:unread', toUid, callback);
	};

	Messaging.markUnread = function(uid, toUid, callback) {
		db.sortedSetAdd('uid:' + uid + ':chats:unread', Date.now(), toUid, callback);
	};

	// todo #1798 -- this utility method creates a room name given an array of uids.
	Messaging.uidsToRoom = function(uids, callback) {
		uid = parseInt(uid, 10);
		if (typeof uid === 'number' && Array.isArray(roomUids)) {
			var room = 'chat_';

			room = room + roomUids.map(function(uid) {
				return parseInt(uid, 10);
			}).sort(function(a, b) {
				return a-b;
			}).join('_');

			callback(null, room);
		} else {
			callback(new Error('invalid-uid-or-participant-uids'));
		}
	};
}(exports));
