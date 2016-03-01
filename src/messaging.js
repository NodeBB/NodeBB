'use strict';


var async = require('async'),
	winston = require('winston'),
	S = require('string'),


	db = require('./database'),
	user = require('./user'),
	plugins = require('./plugins'),
	meta = require('./meta'),
	utils = require('../public/src/utils'),
	notifications = require('./notifications'),
	userNotifications = require('./user/notifications');

(function(Messaging) {

	require('./messaging/create')(Messaging);
	require('./messaging/delete')(Messaging);
	require('./messaging/edit')(Messaging);
	require('./messaging/rooms')(Messaging);
	require('./messaging/unread')(Messaging);
	require('./messaging/notifications')(Messaging);

	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		threemonths: 7776000000
	};

	Messaging.getMessageField = function(mid, field, callback) {
		Messaging.getMessageFields(mid, [field], function(err, fields) {
			callback(err, fields ? fields[field] : null);
		});
	};

	Messaging.getMessageFields = function(mid, fields, callback) {
		db.getObjectFields('message:' + mid, fields, callback);
	};

	Messaging.setMessageField = function(mid, field, content, callback) {
		db.setObjectField('message:' + mid, field, content, callback);
	};

	Messaging.setMessageFields = function(mid, data, callback) {
		db.setObject('message:' + mid, data, callback);
	};

	Messaging.getMessages = function(params, callback) {
		var uid = params.uid,
			roomId = params.roomId,
			since = params.since,
			isNew = params.isNew,
			count = params.count || parseInt(meta.config.chatMessageInboxSize, 10) || 250,
			markRead = params.markRead || true;

		var min = params.count ? 0 : Date.now() - (terms[since] || terms.day);

		if (since === 'recent') {
			count = 49;
			min = 0;
		}

		db.getSortedSetRevRangeByScore('uid:' + uid + ':chat:room:' + roomId + ':mids', 0, count, '+inf', min, function(err, mids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(mids) || !mids.length) {
				return callback(null, []);
			}

			mids.reverse();

			Messaging.getMessagesData(mids, uid, roomId, isNew, callback);
		});

		if (markRead) {
			notifications.markRead('chat_' + roomId + '_' + uid, uid, function(err) {
				if (err) {
					winston.error('[messaging] Could not mark notifications related to this chat as read: ' + err.message);
				}

				userNotifications.pushCount(uid);
			});
		}
	};

	Messaging.getMessagesData = function(mids, uid, roomId, isNew, callback) {

		var keys = mids.map(function(mid) {
			return 'message:' + mid;
		});

		var messages;

		async.waterfall([
			function (next) {
				db.getObjects(keys, next);
			},
			function (_messages, next) {
				messages = _messages.map(function(msg, idx) {
					if (msg) {
						msg.messageId = parseInt(mids[idx], 10);
					}
					return msg;
				}).filter(Boolean);

				var uids = messages.map(function(msg) {
					return msg && msg.fromuid;
				});

				user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status'], next);
			},
			function (users, next) {
				messages.forEach(function(message, index) {
					message.fromUser = users[index];
					var self = parseInt(message.fromuid, 10) === parseInt(uid, 10);
					message.self = self ? 1 : 0;
					message.timestampISO = utils.toISOString(message.timestamp);
					message.newSet = false;
					if (message.hasOwnProperty('edited')) {
						message.editedISO = new Date(parseInt(message.edited, 10)).toISOString();
					}
				});

				async.map(messages, function(message, next) {
					Messaging.parse(message.content, message.fromuid, uid, roomId, isNew, function(result) {
						message.content = result;
						message.cleanedContent = S(result).stripTags().decodeHTMLEntities().s;
						next(null, message);
					});
				}, next);
			},
			function(messages, next) {
				if (messages.length > 1) {
					// Add a spacer in between messages with time gaps between them
					messages = messages.map(function(message, index) {
						// Compare timestamps with the previous message, and check if a spacer needs to be added
						if (index > 0 && parseInt(message.timestamp, 10) > parseInt(messages[index-1].timestamp, 10) + (1000*60*5)) {
							// If it's been 5 minutes, this is a new set of messages
							message.newSet = true;
						} else if (index > 0 && message.fromuid !== messages[index-1].fromuid) {
							// If the previous message was from the other person, this is also a new set
							message.newSet = true;
						}

						return message;
					});

					next(undefined, messages);
				} else if (messages.length === 1) {
					// For single messages, we don't know the context, so look up the previous message and compare
					var key = 'uid:' + uid + ':chat:room:' + roomId + ':mids';
					async.waterfall([
						async.apply(db.sortedSetRank, key, messages[0].messageId),
						function(index, next) {
							// Continue only if this isn't the first message in sorted set
							if (index > 0) {
								db.getSortedSetRange(key, index-1, index-1, next);
							} else {
								messages[0].newSet = true;
								return next(undefined, messages);
							}
						},
						function(mid, next) {
							Messaging.getMessageFields(mid, ['fromuid', 'timestamp'], next);
						}
					], function(err, fields) {
						if (err) {
							return next(err);
						}

						if (
							(parseInt(messages[0].timestamp, 10) > parseInt(fields.timestamp, 10) + (1000*60*5)) ||
							(parseInt(messages[0].fromuid, 10) !== parseInt(fields.fromuid, 10))
						) {
							// If it's been 5 minutes, this is a new set of messages
							messages[0].newSet = true;
						}

						next(undefined, messages);
					});
				} else {
					next(null, []);
				}
			}
		], callback);

	};

	Messaging.parse = function (message, fromuid, uid, roomId, isNew, callback) {
		plugins.fireHook('filter:parse.raw', message, function(err, parsed) {
			if (err) {
				return callback(message);
			}

			var messageData = {
				message: message,
				parsed: parsed,
				fromuid: fromuid,
				uid: uid,
				roomId: roomId,
				isNew: isNew,
				parsedMessage: parsed
			};

			plugins.fireHook('filter:messaging.parse', messageData, function(err, messageData) {
				callback(messageData.parsedMessage);
			});
		});
	};

	Messaging.isNewSet = function(uid, roomId, timestamp, callback) {
		var setKey = 'uid:' + uid + ':chat:room:' + roomId + ':mids';

		async.waterfall([
			function(next) {
				db.getSortedSetRevRangeWithScores(setKey, 0, 0, next);
			},
			function(messages, next) {
				if (messages && messages.length) {
					next(null, parseInt(timestamp, 10) > parseInt(messages[0].score, 10) + (1000 * 60 * 5));
				} else {
					next(null, true);
				}
			}
		], callback);
	};


	Messaging.getRecentChats = function(uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':chat:rooms', start, stop, function(err, roomIds) {
			if (err) {
				return callback(err);
			}

			async.parallel({
				unread: function(next) {
					db.isSortedSetMembers('uid:' + uid + ':chat:rooms:unread', roomIds, next);
				},
				users: function(next) {
					async.map(roomIds, function(roomId, next) {
						db.getSortedSetRevRange('chat:room:' + roomId + ':uids', 0, 3, function(err, uids) {
							if (err) {
								return next(err);
							}
							uids = uids.filter(function(value) {
								return value && parseInt(value, 10) !== parseInt(uid, 10);
							});
							user.getUsersFields(uids, ['uid', 'username', 'picture', 'status', 'lastonline'] , next);
						});
					}, next);
				},
				teasers: function(next) {
					async.map(roomIds, function(roomId, next) {
						Messaging.getTeaser(uid, roomId, next);
					}, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				var rooms = results.users.map(function(users, index) {
					var data = {
						users: users,
						unread: results.unread[index],
						roomId: roomIds[index],
						teaser: results.teasers[index]
					};
					data.users.forEach(function(userData) {
						if (userData && parseInt(userData.uid, 10)) {
							userData.status = user.getStatus(userData);
						}
					});
					data.users = data.users.filter(function(user) {
						return user && parseInt(user.uid, 10);
					});
					data.lastUser = data.users[0];
					data.usernames = data.users.map(function(user) {
						return user.username;
					}).join(', ');
					return data;
				});

				callback(null, {rooms: rooms, nextStart: stop + 1});
			});
		});
	};

	Messaging.getTeaser = function (uid, roomId, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':chat:room:' + roomId + ':mids', 0, 0, next);
			},
			function (mids, next) {
				if (!mids || !mids.length) {
					return next(null, null);
				}
				Messaging.getMessageFields(mids[0], ['content', 'timestamp'], next);
			},
			function (teaser, next) {
				if (teaser && teaser.content) {
					teaser.content = S(teaser.content).stripTags().decodeHTMLEntities().s;
					teaser.timestampISO = utils.toISOString(teaser.timestamp);
			 	}

				next(null, teaser);
			}
		], callback);
	};

	Messaging.canMessageUser = function(uid, toUid, callback) {
		if (parseInt(meta.config.disableChat) === 1 || !uid || uid === toUid) {
			return callback(new Error('[[error:chat-disabled]]'));
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
					isFollowing: async.apply(user.isFollowing, toUid, uid)
				}, next);
			},
			function(results, next) {
				if (!results.settings.restrictChat || results.isAdmin || results.isFollowing) {
					return next();
				}

 				next(new Error('[[error:chat-restricted]]'));
			}
		], callback);
	};

	Messaging.canMessageRoom = function(uid, roomId, callback) {
		if (parseInt(meta.config.disableChat) === 1 || !uid) {
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
			function(count, next) {
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

				next();
			}
		], callback);
	};

	Messaging.hasPrivateChat = function(uid, withUid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					myRooms: async.apply(db.getSortedSetRevRange, 'uid:' + uid + ':chat:rooms', 0, -1),
					theirRooms: async.apply(db.getSortedSetRevRange, 'uid:' + withUid + ':chat:rooms', 0, -1)
				}, next);
			},
			function (results, next) {
				var roomIds = results.myRooms.filter(function(roomId) {
					return roomId && results.theirRooms.indexOf(roomId) !== -1;
				});

				if (!roomIds.length) {
					return callback();
				}

				var index = 0;
				var roomId = 0;
				async.whilst(function() {
					return index < roomIds.length && !roomId;
				}, function(next) {
					Messaging.getUserCountInRoom(roomIds[index], function(err, count) {
						if (err) {
							return next(err);
						}
						if (count === 2) {
							roomId = roomIds[index];
							next(null, roomId);
						} else {
							++ index;
							next();
						}
					});
				}, function(err) {
					next(err, roomId);
				});
			}
		], callback);
	};


}(exports));
