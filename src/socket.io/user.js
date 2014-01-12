var	user = require('../user'),
	topics = require('../topics'),

	SocketUser = {};

SocketUser.exists = function(data, sessionData) {
	if (data.username) {
		user.exists(utils.slugify(data.username), function(exists) {
			sessionData.socket.emit('api:user.exists', {
				exists: exists
			});
		});
	}
};

SocketUser.count = function(callback) {
	user.count(callback);
};

SocketUser.emailExists = function(data, callback, sessionData) {
	user.email.exists(undefined, data.email, callback);
};

// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(data, sessionData) {
	user.reset.send(sessionData.socket, data.email);
};

SocketUser.reset.valid = function(data, sessionData) {
	user.reset.validate(sessionData.socket, data.code);
};

SocketUser.reset.commit = function(data, sessionData) {
	user.reset.commit(sessionData.socket, data.code, data.password);
};

SocketUser.isOnline = function(uid, callback) {
	callback({
		online: module.parent.exports.isUserOnline(uid),
		uid: uid,
		timestamp: Date.now()
	});
};

SocketUser.changePassword = function(data, callback, sessionData) {
	user.changePassword(sessionData.uid, data, callback);
};

SocketUser.updateProfile = function(data, callback, sessionData) {
	user.updateProfile(sessionData.uid, data, callback);
};

SocketUser.changePicture = function(data, callback, sessionData) {

	var type = data.type;

	function updateHeader() {
		user.getUserFields(sessionData.uid, ['picture'], function(err, fields) {
			if (!err && fields) {
				fields.uid = sessionData.uid;
				sessionData.socket.emit('api:updateHeader', fields);
				callback(true);
			} else {
				callback(false);
			}
		});
	}

	if (type === 'gravatar') {
		user.getUserField(sessionData.uid, 'gravatarpicture', function(err, gravatar) {
			user.setUserField(sessionData.uid, 'picture', gravatar);
			updateHeader();
		});
	} else if (type === 'uploaded') {
		user.getUserField(sessionData.uid, 'uploadedpicture', function(err, uploadedpicture) {
			user.setUserField(sessionData.uid, 'picture', uploadedpicture);
			updateHeader();
		});
	} else {
		callback(false);
	}
};

SocketUser.follow = function(data, callback, sessionData) {
	if (sessionData.uid) {
		user.follow(sessionData.uid, data.uid, callback);
	}
};

SocketUser.unfollow = function(data, callback, sessionData) {
	if (sessionData.uid) {
		user.unfollow(sessionData.uid, data.uid, callback);
	}
};

SocketUser.saveSettings = function(data, callback, sessionData) {
	if (sessionData.uid) {
		user.setUserFields(sessionData.uid, {
			showemail: data.showemail
		}, function(err, result) {
			callback(err);
		});
	}
};

SocketUser.get_online_users = function(data, callback) {
	var returnData = [];

	for (var i = 0; i < data.length; ++i) {
		var uid = data[i];
		if (module.parent.exports.isUserOnline(uid))
			returnData.push(uid);
		else
			returnData.push(0);
	}

	callback(returnData);
};

SocketUser.getOnlineAnonCount = function(data, callback) {
	callback(module.parent.exports.getOnlineAnonCount());
};

SocketUser.getUnreadCount = function(callback, sessionData) {
	topics.getUnreadTids(sessionData.uid, 0, 19, function(err, tids) {
		callback(tids.length);
	});
};

SocketUser.getActiveUsers = function(callback) {
	module.parent.exports.emitOnlineUserCount(callback);
};

SocketUser.loadMore = function(data, callback) {
	var start = data.after,
		end = start + 19;

	user.getUsers(data.set, start, end, function(err, data) {
		if (err) {
			winston.err(err);
		} else {
			callback({
				users: data
			});
		}
	});
};

/* Exports */

module.exports = SocketUser;