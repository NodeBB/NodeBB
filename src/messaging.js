'use strict';

var db = require('./database'),
	async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
	S = require('string'),

	user = require('./user'),
	plugins = require('./plugins'),
	meta = require('./meta'),
	utils = require('../public/src/utils'),
	notifications = require('./notifications'),
	userNotifications = require('./user/notifications'),
	emailer = require('./emailer'),
	sockets = require('./socket.io');

(function(Messaging) {
	Messaging.notifyQueue = {};	// Only used to notify a user of a new chat message, see Messaging.notifyUser

	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		threemonths: 7776000000
	};

	function sortUids(fromuid, touid) {
		return [fromuid, touid].sort();
	}

	Messaging.addMessage = function(fromuid, touid, content, timestamp, callback) {
		if (typeof timestamp === 'function') {
			callback = timestamp;
			timestamp = Date.now();
		} else {
			timestamp = timestamp || Date.now();
		}

		if (!content) {
			return callback(new Error('[[error:invalid-chat-message]]'));
		}

		if (content.length > (meta.config.maximumChatMessageLength || 1000)) {
			return callback(new Error('[[error:chat-message-too-long]]'));
		}

		var uids = sortUids(fromuid, touid);

		db.incrObjectField('global', 'nextMid', function(err, mid) {
			if (err) {
				return callback(err);
			}
			var message = {
				content: content,
				timestamp: timestamp,
				fromuid: fromuid,
				touid: touid
			};

			async.waterfall([
				function(next) {
					plugins.fireHook('filter:messaging.save', message, next);
				},
				function(message, next) {
					db.setObject('message:' + mid, message, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					async.apply(db.sortedSetAdd, 'messages:uid:' + uids[0] + ':to:' + uids[1], timestamp, mid),
					async.apply(Messaging.updateChatTime, fromuid, touid),
					async.apply(Messaging.updateChatTime, touid, fromuid),
					async.apply(Messaging.markRead, fromuid, touid),
					async.apply(Messaging.markUnread, touid, fromuid),
				], function(err) {
					if (err) {
						return callback(err);
					}

					async.waterfall([
						function(next) {
							getMessages([mid], fromuid, touid, true, next);
						},
						function(messages, next) {
							Messaging.isNewSet(fromuid, touid, mid, function(err, isNewSet) {
								if (err) {
									return next(err);
								}

								if (!messages || !messages[0]) {
									return next(null, null);
								}

								messages[0].newSet = isNewSet;
								messages[0].mid = mid;
								next(null, messages[0]);
							});
						}
					], callback);
				});
			});
		});
	};

	Messaging.getMessages = function(params, callback) {
		var fromuid = params.fromuid,
			touid = params.touid,
			since = params.since,
			isNew = params.isNew,
			count = params.count || parseInt(meta.config.chatMessageInboxSize, 10) || 250;

		var uids = sortUids(fromuid, touid),
			min = params.count ? 0 : Date.now() - (terms[since] || terms.day);

		if (since === 'recent') {
			count = 49;
			min = 0;
		}

		db.getSortedSetRevRangeByScore('messages:uid:' + uids[0] + ':to:' + uids[1], 0, count, '+inf', min, function(err, mids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(mids) || !mids.length) {
				return callback(null, []);
			}

			mids.reverse();

			getMessages(mids, fromuid, touid, isNew, callback);
		});

		notifications.markRead('chat_' + touid + '_' + fromuid, fromuid, function(err) {
			if (err) {
				winston.error('[messaging] Could not mark notifications related to this chat as read: ' + err.message);
			}

			userNotifications.pushCount(fromuid);
		});
	};

	function getMessages(mids, fromuid, touid, isNew, callback) {
		user.getUsersFields([fromuid, touid], ['uid', 'username', 'userslug', 'picture', 'icon:bgColor', 'icon:text', 'status'], function(err, userData) {
			if(err) {
				return callback(err);
			}

			var keys = mids.map(function(mid) {
				return 'message:' + mid;
			});

			async.waterfall([
				async.apply(db.getObjects, keys),
				function(messages, next) {
					messages = messages.filter(Boolean);
					async.map(messages, function(message, next) {
						var self = parseInt(message.fromuid, 10) === parseInt(fromuid, 10);
						message.fromUser = self ? userData[0] : userData[1];
						message.toUser = self ? userData[1] : userData[0];
						message.timestampISO = utils.toISOString(message.timestamp);
						message.self = self ? 1 : 0;
						message.newSet = false;

						Messaging.parse(message.content, message.fromuid, fromuid, userData[1], userData[0], isNew, function(result) {
							message.content = result;
							message.cleanedContent = S(result).stripTags().decodeHTMLEntities().s;
							next(null, message);
						});
					}, next);
				},
				function(messages, next) {
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
				}
			], callback);
		});
	}

	Messaging.parse = function (message, fromuid, myuid, toUserData, myUserData, isNew, callback) {
		plugins.fireHook('filter:parse.raw', message, function(err, parsed) {
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

	Messaging.isNewSet = function(fromuid, touid, mid, callback) {
		var uids = sortUids(fromuid, touid),
			setKey = 'messages:uid:' + uids[0] + ':to:' + uids[1];

		async.waterfall([
			async.apply(db.sortedSetRank, setKey, mid),
			function(index, next) {
				if (index > 0) {
					db.getSortedSetRange(setKey, index-1, index, next);
				} else {
					next(null, true);
				}
			},
			function(mids, next) {
				if (typeof mids !== 'boolean' && mids && mids.length) {
					db.getObjects(['message:' + mids[0], 'message:' + mids[1]], next);
				} else {
					next(null, mids);
				}
			},
			function(messages, next) {
				if (typeof messages !== 'boolean' && messages && messages.length) {
					next(null, parseInt(messages[1].timestamp, 10) > parseInt(messages[0].timestamp, 10) + (1000*60*5));
				} else {
					next(null, messages);
				}
			}
		], callback);
	};

	Messaging.updateChatTime = function(uid, toUid, callback) {
		callback = callback || function() {};
		db.sortedSetAdd('uid:' + uid + ':chats', Date.now(), toUid, callback);
	};

	Messaging.getRecentChats = function(uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':chats', start, stop, function(err, uids) {
			if (err) {
				return callback(err);
			}

			async.parallel({
				unread: function(next) {
					db.isSortedSetMembers('uid:' + uid + ':chats:unread', uids, next);
				},
				users: function(next) {
					user.getUsersFields(uids, ['uid', 'username', 'picture', 'icon:bgColor', 'icon:text', 'status'] , next);
				},
				teasers: function(next) {
					async.map(uids, function(fromuid, next) {
						Messaging.getMessages({
							fromuid: fromuid,
							touid: uid,
							isNew: false,
							count: 1
						}, function(err, teaser) {
							var teaser = teaser[0];
							teaser.content = S(teaser.content).stripTags().decodeHTMLEntities().s;
							next(err, teaser);
						});
					}, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.users.forEach(function(user, index) {
					if (user && parseInt(user.uid, 10)) {
						Messaging.markRead(uid, uids[index]);
						user.unread = results.unread[index];
						user.status = sockets.isUserOnline(user.uid) ? user.status : 'offline';
						user.teaser = results.teasers[index];
					}
				});

				results.users = results.users.filter(function(user) {
					return user && parseInt(user.uid, 10);
				});

				callback(null, {users: results.users, nextStart: stop + 1});
			});
		});
	};

	Messaging.getUnreadCount = function(uid, callback) {
		db.sortedSetCard('uid:' + uid + ':chats:unread', callback);
	};

	Messaging.pushUnreadCount = function(uid) {
		Messaging.getUnreadCount(uid, function(err, unreadCount) {
			if (err) {
				return;
			}
			sockets.in('uid_' + uid).emit('event:unread.updateChatCount', null, unreadCount);
		});
	};

	Messaging.markRead = function(uid, toUid, callback) {
		db.sortedSetRemove('uid:' + uid + ':chats:unread', toUid, callback);
	};

	Messaging.markUnread = function(uid, toUid, callback) {
		async.waterfall([
			function (next) {
				user.exists(toUid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-user]]'));
				}
				db.sortedSetAdd('uid:' + uid + ':chats:unread', Date.now(), toUid, next);
			}
		], callback);
	};

	Messaging.notifyUser = function(fromuid, touid, messageObj) {
		// Immediate notifications
		// Recipient
		Messaging.pushUnreadCount(touid);
		sockets.in('uid_' + touid).emit('event:chats.receive', {
			withUid: fromuid,
			message: messageObj,
			self: 0
		});
		// Sender
		Messaging.pushUnreadCount(fromuid);
		sockets.in('uid_' + fromuid).emit('event:chats.receive', {
			withUid: touid,
			message: messageObj,
			self: 1
		});

		// Delayed notifications
		var queueObj = Messaging.notifyQueue[fromuid + ':' + touid];
		if (queueObj) {
			queueObj.message.content += '\n' + messageObj.content;
			clearTimeout(queueObj.timeout);
		} else {
			queueObj = Messaging.notifyQueue[fromuid + ':' + touid] = {
				message: messageObj
			};
		}

		queueObj.timeout = setTimeout(function() {
			sendNotifications(fromuid, touid, queueObj.message, function(err) {
				if (!err) {
					delete Messaging.notifyQueue[fromuid + ':' + touid];
				}
			});
		}, 1000*60);	// wait 60s before sending
	};

	Messaging.canMessage = function(fromUid, toUid, callback) {
		if (parseInt(meta.config.disableChat) === 1) {
			return callback(new Error('[[error:chat-disabled]]'));
		} else if (toUid === fromUid) {
			return callback(new Error('[[error:cant-chat-with-yourself]]'));
		} else if (!fromUid) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		async.waterfall([
			function (next) {
				user.exists(toUid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-user]]'));
				}
				user.getUserFields(fromUid, ['banned', 'email:confirmed'], next);
			},
			function (userData, next) {
				if (parseInt(userData.banned, 10) === 1) {
					return next(new Error('[[error:user-banned]]'));
				}

				if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
					return next(new Error('[[error:email-not-confirmed-chat]]'));
				}

				user.getSettings(toUid, next);
			},
			function(settings, next) {
				if (!settings.restrictChat) {
					return callback(null, true);
				}

				user.isAdministrator(fromUid, next);
			},
			function(isAdmin, next) {
				if (isAdmin) {
					return callback(null, true);
				}
				user.isFollowing(toUid, fromUid, next);
			}
		], callback);
	};

	function sendNotifications(fromuid, touid, messageObj, callback) {
		if (sockets.isUserOnline(touid)) {
			return callback();
		}

		notifications.create({
			bodyShort: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
			bodyLong: messageObj.content,
			nid: 'chat_' + fromuid + '_' + touid,
			from: fromuid,
			path: '/chats/' + messageObj.fromUser.username
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, [touid], callback);
			}
		});

		user.getSettings(messageObj.toUser.uid, function(err, settings) {
			if (settings.sendChatNotifications && !parseInt(meta.config.disableEmailSubscriptions, 10)) {
				emailer.send('notif_chat', touid, {
					subject: '[[email:notif.chat.subject, ' + messageObj.fromUser.username + ']]',
					username: messageObj.toUser.username,
					userslug: utils.slugify(messageObj.toUser.username),
					summary: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
					message: messageObj,
					site_title: meta.config.title || 'NodeBB',
					url: nconf.get('url'),
					fromUserslug: utils.slugify(messageObj.fromUser.username)
				});
			}
		});
	}

}(exports));
