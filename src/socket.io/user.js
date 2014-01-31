var	async = require('async'),
	user = require('../user'),
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
	if(data && data.email) {
		user.email.exists(data.email, callback);
	}
};

SocketUser.search = function(socket, username, callback) {
	user.search(username, callback);
};

// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(socket, data, callback) {
	if(data && data.email) {
		user.reset.send(socket, data.email, callback);
	}
};

SocketUser.reset.valid = function(socket, data, callback) {
	if(data && data.code) {
		user.reset.validate(socket, data.code, callback);
	}
};

SocketUser.reset.commit = function(socket, data, callback) {
	if(data && data.code && data.password) {
		user.reset.commit(socket, data.code, data.password, callback);
	}
};

SocketUser.isOnline = function(socket, uid, callback) {
	user.getUserField(uid, 'status', function(err, status) {
		if(err) {
			return callback(err);
		}

		if(!status) {
			status = 'online';
		}

		var online = module.parent.exports.isUserOnline(uid);
		if(!online) {
			status = 'offline';
		}

		if(status === 'offline') {
			online = false;
		}

		callback(null, {
			online: online,
			uid: uid,
			timestamp: Date.now(),
			status: status
		});
	});
};

SocketUser.changePassword = function(socket, data, callback) {
	if(data) {
		user.changePassword(socket.uid, data, callback);
	}
};

SocketUser.updateProfile = function(socket, data, callback) {
	if(data) {
		user.updateProfile(socket.uid, data, callback);
	}
};

SocketUser.changePicture = function(socket, data, callback) {
	if(!data) {
		return;
	}

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
	if (socket.uid && data) {
		user.follow(socket.uid, data.uid, callback);
	}
};

SocketUser.unfollow = function(socket, data, callback) {
	if (socket.uid && data) {
		user.unfollow(socket.uid, data.uid, callback);
	}
};

SocketUser.saveSettings = function(socket, data, callback) {
	if (socket.uid && data) {
		user.setUserFields(socket.uid, {
			showemail: data.showemail
		}, callback);
	}
};

SocketUser.getOnlineUsers = function(socket, data, callback) {
	var returnData = {};
	if(!data) {
		return callback(new Error('invalid-data'));
	}

	function getUserStatus(uid, next) {
		SocketUser.isOnline(socket, uid, function(err, data) {
			if(err) {
				return next(err);
			}
			returnData[uid] = data;
			next();
		});
	}

	async.each(data, getUserStatus, function(err) {
		callback(err, returnData);
	});
};

SocketUser.getOnlineAnonCount = function(socket, data, callback) {
	callback(null, module.parent.exports.getOnlineAnonCount());
};

SocketUser.getUnreadCount = function(socket, data, callback) {
	topics.getUnreadTids(socket.uid, 0, 19, callback);
};

SocketUser.getActiveUsers = function(socket, data, callback) {
	module.parent.exports.emitOnlineUserCount(callback);
};

SocketUser.loadMore = function(socket, data, callback) {
	if(data) {
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
	}
};

SocketUser.setStatus = function(socket, status, callback) {
	var server = require('./index');
	user.setUserField(socket.uid, 'status', status, function(err) {
		SocketUser.isOnline(socket, socket.uid, function(err, data) {
			server.server.sockets.emit('user.isOnline', err, data);
		});
	});
};

/* Exports */

module.exports = SocketUser;