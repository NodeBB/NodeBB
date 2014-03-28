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

			db.setObject('message:' + mid, message, function(err) {
				if (err) {
					return callback(err);
				}

				db.listAppend('messages:' + uids[0] + ':' + uids[1], mid);

				Messaging.updateChatTime(fromuid, touid);
				Messaging.updateChatTime(touid, fromuid);

				getMessages([mid], fromuid, touid, true, function(err, messages) {
					callback(err, messages ? messages[0] : null);
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
					message.user = parseInt(message.fromuid, 10) === parseInt(fromuid, 10) ? userData[0] : userData[1];

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
		db.sortedSetAdd('uid:' + uid + ':chats', Date.now(), toUid, function(err) {
			if (callback) {
				callback(err);
			}
		});
	};

	Messaging.getRecentChats = function(uid, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':chats', 0, 9, function(err, uids) {
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

}(exports));