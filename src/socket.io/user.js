'use strict';

var	async = require('async'),
	user = require('../user'),
	groups = require('../groups'),
	topics = require('../topics'),
	messaging = require('../messaging'),
	plugins = require('../plugins'),
	utils = require('./../../public/src/utils'),
	meta = require('../meta'),
	SocketUser = {};

SocketUser.exists = function(socket, data, callback) {
	if (data && data.username) {
		meta.userOrGroupExists(utils.slugify(data.username), callback);
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

SocketUser.emailConfirm = function(socket, data, callback) {
	if (socket.uid && parseInt(meta.config.requireEmailConfirmation, 10) === 1) {
		user.getUserField(socket.uid, 'email', function(err, email) {
			if (err) {
				return callback(err);
			}

			if (!email) {
				return;
			}

			user.email.verify(socket.uid, email);
			callback();
		});
	}
};

SocketUser.increaseViewCount = function(socket, uid, callback) {
	if (uid) {
		if (socket.uid !== parseInt(uid, 10)) {
			user.incrementUserFieldBy(uid, 'profileviews', 1, callback);
		}
	}
};

SocketUser.search = function(socket, username, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}
	user.search(username, callback);
};

// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(socket, email, callback) {
	if (email) {
		user.reset.send(socket, email, callback);
	}
};

SocketUser.reset.valid = function(socket, code, callback) {
	if (code) {
		user.reset.validate(socket, code, callback);
	}
};

SocketUser.reset.commit = function(socket, data, callback) {
	if(data && data.code && data.password) {
		user.reset.commit(socket, data.code, data.password, callback);
	}
};

SocketUser.isOnline = function(socket, uid, callback) {
	user.isOnline([uid], function(err, data) {
		callback(err, Array.isArray(data) ? data[0] : null);
	});
};

SocketUser.changePassword = function(socket, data, callback) {
	if(data) {
		user.changePassword(socket.uid, data, callback);
	}
};

SocketUser.updateProfile = function(socket, data, callback) {
	if(!data || !data.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if(socket.uid === parseInt(data.uid, 10)) {
		return user.updateProfile(socket.uid, data, callback);
	}

	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if(err) {
			return callback(err);
		}

		if(!isAdmin) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		user.updateProfile(data.uid, data, callback);
	});
};

SocketUser.changePicture = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var type = data.type;

	function changePicture(uid, callback) {
		user.getUserField(uid, type, function(err, picture) {
			if(err) {
				return callback(err);
			}

			user.setUserField(uid, 'picture', picture, callback);
		});
	}

	if (type === 'gravatar') {
		type = 'gravatarpicture';
	} else if (type === 'uploaded') {
		type = 'uploadedpicture';
	} else {
		return callback(new Error('[[error:invalid-image-type]]'));
	}

	if(socket.uid === parseInt(data.uid, 10)) {
		changePicture(socket.uid, function(err) {
			if(err) {
				return callback(err);
			}
		});
		return;
	}

	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if(err) {
			return callback(err);
		}

		if(!isAdmin) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		changePicture(data.uid, callback);
	});
};

SocketUser.follow = function(socket, data, callback) {
	if (socket.uid && data) {
		toggleFollow('follow', socket.uid, data.uid, callback);
	}
};

SocketUser.unfollow = function(socket, data, callback) {
	if (socket.uid && data) {
		toggleFollow('unfollow', socket.uid, data.uid, callback);
	}
};

function toggleFollow(method, uid, theiruid, callback) {
	user[method](uid, theiruid, function(err) {
		if (err) {
			return callback(err);
		}

		plugins.fireHook('action:user.' + method, {
			fromUid: uid,
			toUid: theiruid
		});
		callback();
	});
}

SocketUser.getSettings = function(socket, data, callback) {
	if (socket.uid) {
		if (socket.uid === parseInt(data.uid, 10)) {
			return user.getSettings(socket.uid, callback);
		}

		user.isAdministrator(socket.uid, function(err, isAdmin) {
			if (err) {
				return callback(err);
			}

			if (!isAdmin) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			user.getSettings(data.uid, callback);
		});
	}
};

SocketUser.saveSettings = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (socket.uid === parseInt(data.uid, 10)) {
		return user.saveSettings(socket.uid, data.settings, callback);
	}

	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (err) {
			return callback(err);
		}

		if (!isAdmin) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		user.saveSettings(data.uid, data.settings, callback);
	});
};

SocketUser.setTopicSort = function(socket, sort, callback) {
	if (socket.uid) {
		user.setSetting(socket.uid, 'topicPostSort', sort, callback);
	}
};

SocketUser.getOnlineUsers = function(socket, uids, callback) {
	var returnData = {};
	if (!uids) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.isOnline(uids, function(err, userData) {
		if (err) {
			return callback(err);
		}

		userData.forEach(function(user) {
			if (user) {
				returnData[user.uid] = user;
			}
		});
		callback(null, returnData);
	});
};

SocketUser.getOnlineAnonCount = function(socket, data, callback) {
	callback(null, module.parent.exports.getOnlineAnonCount());
};

SocketUser.getUnreadCount = function(socket, data, callback) {
	topics.getTotalUnread(socket.uid, callback);
};

SocketUser.getUnreadChatCount = function(socket, data, callback) {
	messaging.getUnreadCount(socket.uid, callback);
};

SocketUser.getActiveUsers = function(socket, data, callback) {
	module.parent.exports.emitOnlineUserCount(callback);
};

SocketUser.loadMore = function(socket, data, callback) {
	if(!data || !data.set || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!socket.uid && !!parseInt(meta.config.privateUserInfo, 10)) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	var start = data.after,
		end = start + 19;

	user.getUsersFromSet(data.set, start, end, function(err, userData) {
		if(err) {
			return callback(err);
		}

		user.isAdministrator(socket.uid, function (err, isAdministrator) {
			if(err) {
				return callback(err);
			}

			if(!isAdministrator && data.set === 'users:online') {
				userData = userData.filter(function(item) {
					return item.status !== 'offline';
				});
			}

			callback(null, {
				users: userData
			});
		});
	});
};


SocketUser.setStatus = function(socket, status, callback) {
	var server = require('./index');
	user.setUserField(socket.uid, 'status', status, function(err) {
		SocketUser.isOnline(socket, socket.uid, function(err, data) {
			server.server.sockets.emit('user.isOnline', err, data);
			callback(err, data);
		});
	});
};

/* Exports */

module.exports = SocketUser;
