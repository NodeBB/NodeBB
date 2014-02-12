var db = require('./database'),
	async = require('async'),
	user = require('./user'),
	plugins = require('./plugins'),
	meta = require('./meta');


(function(Messaging) {

	function sortUids(fromuid, touid) {
		var uids = [fromuid, touid];
		uids.sort();
		return uids;
	}

	Messaging.addMessage = function(fromuid, touid, content, callback) {
		var uids = sortUids(fromuid, touid);

		db.incrObjectField('global', 'nextMid', function(err, mid) {
			if (err) {
				return callback(err, null);
			}

			var message = {
				content: content,
				timestamp: Date.now(),
				fromuid: fromuid,
				touid: touid
			};

			db.setObject('message:' + mid, message);
			db.listAppend('messages:' + uids[0] + ':' + uids[1], mid);

			Messaging.updateChatTime(fromuid, touid);
			Messaging.updateChatTime(touid, fromuid);
			callback(null, message);
		});
	}

	Messaging.getMessages = function(fromuid, touid, callback) {
		var uids = sortUids(fromuid, touid);

		db.getListRange('messages:' + uids[0] + ':' + uids[1], -((meta.config.chatMessagesToDisplay || 50) - 1), -1, function(err, mids) {
			if (err) {
				return callback(err, null);
			}

			if (!mids || !mids.length) {
				return callback(null, []);
			}

			user.getMultipleUserFields([fromuid, touid], ['username', 'userslug', 'picture'], function(err, userData) {
				if(err) {
					return callback(err, null);
				}

				userData[0].uid = touid;
				userData[1].uid = fromuid;

				function getMessage(mid, next) {
					db.getObject('message:' + mid, function(err, message) {
						if (err) {
							return next(err);
						}

						Messaging.parse(message.content, message.fromuid, fromuid, userData[1], userData[0], false, function(result) {
							message.content = result;
							next(null, message);
						});
					});
				}

				async.map(mids, getMessage, callback);
			});
		});
	};

	Messaging.parse = function (message, fromuid, myuid, toUserData, myUserData, isNew, callback) {
		plugins.fireHook('filter:post.parse', message, function(err, parsed) {
			if (err) {
				return callback(message);
			}
			var username,
				picture;

			if (parseInt(fromuid, 10) === parseInt(myuid, 10)) {
				picture = '<a href="/user/' + myUserData.userslug + '"><img class="chat-user-image" src="' + myUserData.picture + '"></a>';
				username = '<span class="chat-user chat-user-you"> '+ myUserData.username + '</span>: ';
			} else {
				picture = '<a href="/user/' + toUserData.userslug + '"><img class="chat-user-image" src="' + toUserData.picture + '"></a>';
				username = '<span class="chat-user"> ' + toUserData.username + '</span>: ';
			}

			var messageData = {
				message: message,
				parsed: parsed,
				fromuid: fromuid,
				myuid: myuid,
				toUserData: toUserData,
				myUserData: myUserData,
				isNew: isNew,
				parsedMessage: picture + username + parsed
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

			user.getMultipleUserFields(uids, ['username', 'picture', 'uid'], callback);
		});
	};

}(exports));