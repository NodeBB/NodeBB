var	user = require('../user'),
	topics = require('../topics'),

	SocketUser = {};

SocketUser.exists = function(data) {
	if (data.username) {
		user.exists(utils.slugify(data.username), function(exists) {
			socket.emit('user.exists', {
				exists: exists
			});
		});
	}
};

SocketUser.count = function(callback) {
	user.count(callback);
};

SocketUser.emailExists = function(data) {
	user.email.exists(socket, data.email);
};

// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(data) {
	user.reset.send(socket, data.email);
};

SocketUser.reset.valid = function(data) {
	user.reset.validate(socket, data.code);
};

SocketUser.reset.commit = function(data) {
	user.reset.commit(socket, data.code, data.password);
};

SocketUser.isOnline = function(uid, callback) {
	callback({
		online: module.parent.exports.isUserOnline(uid),
		uid: uid,
		timestamp: Date.now()
	});
};

SocketUser.changePassword = function(data, callback) {
	user.changePassword(uid, data, callback);
};

SocketUser.updateProfile = function(data, callback) {
	user.updateProfile(uid, data, callback);
};

SocketUser.changePicture = function(data, callback) {

	var type = data.type;

	function updateHeader() {
		user.getUserFields(uid, ['picture'], function(err, fields) {
			if (!err && fields) {
				fields.uid = uid;
				socket.emit('api:updateHeader', fields);
				callback(true);
			} else {
				callback(false);
			}
		});
	}

	if (type === 'gravatar') {
		user.getUserField(uid, 'gravatarpicture', function(err, gravatar) {
			user.setUserField(uid, 'picture', gravatar);
			updateHeader();
		});
	} else if (type === 'uploaded') {
		user.getUserField(uid, 'uploadedpicture', function(err, uploadedpicture) {
			user.setUserField(uid, 'picture', uploadedpicture);
			updateHeader();
		});
	} else {
		callback(false);
	}
};

SocketUser.follow = function(data, callback) {
	if (uid) {
		user.follow(uid, data.uid, callback);
	}
};

SocketUser.unfollow = function(data, callback) {
	if (uid) {
		user.unfollow(uid, data.uid, callback);
	}
};

SocketUser.saveSettings = function(data, callback) {
	if (uid) {
		user.setUserFields(uid, {
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

/* Exports */

module.exports = SocketUser;