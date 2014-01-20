var db = require('./database'),
	async = require('async'),
	user = require('./user'),
    plugins = require('./plugins');
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


			user.getUserField(touid, 'username', function(err, tousername) {
				if(err) {
					return callback(err, null);
				}

				var messages = [];

				function getMessage(mid, next) {
					db.getObject('message:' + mid, function(err, message) {
						if (err) {
							return next(err);
						}

						Messaging.parse(message.content, message.fromuid, fromuid, tousername, function(result) {
							message.content = result;
							messages.push(message);
							next(null);
						});
					});
				}

				async.eachSeries(mids, getMessage, function(err) {
					if (err) {
						return callback(err, null);
					}

					callback(null, messages);
				});
			});
		});
	};

	Messaging.parse = function (message, fromuid, myuid, tousername, callback) {
		plugins.fireHook('filter:post.parse', message, function(err, parsed) {
			if (err) {
				return callback(message);
			}
			var username;
			if (fromuid === myuid) {
				username = "<span class='chat-user chat-user-you'>You</span>: ";
			} else {
				username = "<span class='chat-user'>" + tousername + "</span>: ";
			}

			callback(username + parsed);
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