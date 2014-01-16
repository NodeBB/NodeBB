var	user = require('../user'),
	topics = require('../topics'),

	SocketUser = {};

SocketUser.exists = function(socket, data, callback) {
	if (data && data.username) {
		user.exists(utils.slugify(data.username), callback);
	}
};

SocketUser.count = function(socket, data, callback) {
	user.count(callback);
};

SocketUser.emailExists = function(socket, data, callback) {
	user.email.exists(data.email, callback);
};

// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(socket, data, callback) {
	user.reset.send(socket, data.email);
};

SocketUser.reset.valid = function(socket, data, callback) {
	user.reset.validate(socket, data.code);
};

SocketUser.reset.commit = function(socket, data, callback) {
	user.reset.commit(socket, data.code, data.password);
};

SocketUser.isOnline = function(socket, uid, callback) {
	callback(null, {
		online: module.parent.exports.isUserOnline(uid),
		uid: uid,
		timestamp: Date.now()
	});
};

SocketUser.changePassword = function(socket, data, callback) {
	user.changePassword(socket.uid, data, callback);
};

SocketUser.updateProfile = function(socket, data, callback) {
	user.updateProfile(socket.uid, data, callback);
};

SocketUser.changePicture = function(socket, data, callback) {

	var type = data.type;

	function updateHeader() {
		user.getUserFields(socket.uid, ['picture'], function(err, fields) {
			if(err) {
				return callback(err);
			}

			if (fields) {
				fields.uid = socket.uid;
				socket.emit('meta.updateHeader', null, fields);
			}

			callback(null);
		});
	}

	if (type === 'gravatar') {
		type = 'gravatarpicture';
	} else if (type === 'uploaded') {
		type = 'uploadedpicture';
	} else {
		return callback(new Error('invalid-image-type'));
	}

	user.getUserField(socket.uid, type, function(err, picture) {
		user.setUserField(socket.uid, 'picture', picture);
		updateHeader();
	});
};

SocketUser.follow = function(socket, data, callback) {
	if (socket.uid) {
		user.follow(socket.uid, data.uid, callback);
	}
};

SocketUser.unfollow = function(socket, data, callback) {
	if (socket.uid) {
		user.unfollow(socket.uid, data.uid, callback);
	}
};

SocketUser.saveSettings = function(socket, data, callback) {
	if (socket.uid) {
		user.setUserFields(socket.uid, {
			showemail: data.showemail
		}, callback);
	}
};

SocketUser.getOnlineUsers = function(socket, data, callback) {
	var returnData = [];

	for (var i = 0; i < data.length; ++i) {
		var uid = data[i];
		if (module.parent.exports.isUserOnline(uid)) {
			returnData.push(uid);
		} else {
			returnData.push(0);
		}
	}

	callback(null, returnData);
};

SocketUser.getOnlineAnonCount = function(socket, data, callback) {
	callback(null, module.parent.exports.getOnlineAnonCount());
};

SocketUser.getUnreadCount = function(socket, data, callback) {
	topics.getUnreadTids(socket.uid, 0, 19, function(err, tids) {
		callback(err, tids?tids.length:0);
	});
};

SocketUser.getActiveUsers = function(socket, data, callback) {
	module.parent.exports.emitOnlineUserCount(callback);
};

SocketUser.loadMore = function(socket, data, callback) {
	var start = data.after,
		end = start + 19;

	user.getUsers(data.set, start, end, function(err, data) {
		if(err) {
			return callback(err);
		}

		callback(null, {
			users: data
		});
	});
};

/* Exports */

module.exports = SocketUser;