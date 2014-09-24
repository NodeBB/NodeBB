'use strict';

var	async = require('async'),
	nconf = require('nconf'),
	user = require('../user'),
	groups = require('../groups'),
	topics = require('../topics'),
	posts = require('../posts'),
	notifications = require('../notifications'),
	messaging = require('../messaging'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	websockets = require('./index'),
	meta = require('../meta'),
	SocketUser = {};

SocketUser.exists = function(socket, data, callback) {
	if (data && data.username) {
		meta.userOrGroupExists(utils.slugify(data.username), callback);
	}
};

SocketUser.deleteAccount = function(socket, data, callback) {
	if (socket.uid) {
		user.isAdministrator(socket.uid, function(err, isAdmin) {
			if (err || isAdmin) {
				return callback(err || new Error('[[error:cant-delete-admin]]'));
			}
			user.deleteAccount(socket.uid, callback);
		});
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

SocketUser.checkStatus = function(socket, uid, callback) {
	if (!socket.uid) {
		return callback('[[error:invalid-uid]]');
	}
	var online = websockets.isUserOnline(uid);
	if (!online) {
		return callback(null, 'offline');
	}
	user.getUserField(uid, 'status', function(err, status) {
		if (err) {
			return callback(err);
		}
		status = status || 'online';
		callback(null, status);
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

SocketUser.uploadProfileImageFromUrl = function(socket, url, callback) {
	if (!socket.uid || !url) {
		return;
	}

	plugins.fireHook('filter:uploadImage', {url: url}, function(err, image) {
		if (err) {
			return callback(err);
		}

		user.setUserFields(socket.uid, {uploadedpicture: image.url, picture: image.url}, function(err) {
			callback(err, image.url);
		});
	});
}

SocketUser.follow = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return;
	}

	toggleFollow('follow', socket.uid, data.uid, function(err) {
		if (err) {
			return callback(err);
		}

		user.getUserFields(socket.uid, ['username', 'userslug'], function(err, userData) {
			if (err) {
				return callback(err);
			}

			notifications.create({
				bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
				path: nconf.get('relative_path') + '/user/' + userData.userslug,
				nid: 'follow:' + data.uid + ':uid:' + socket.uid,
				from: socket.uid
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, [data.uid]);
				}
				callback(err);
			});
		});
	});
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

SocketUser.loadMoreRecentPosts = function(socket, data, callback) {
	if(!data || !data.uid || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = Math.max(0, parseInt(data.after, 10)),
		end = start + 9;

	posts.getPostsByUid(socket.uid, data.uid, start, end, callback);
};

SocketUser.setStatus = function(socket, status, callback) {
	if (!socket.uid) {
		return callback(new Error('[[invalid-uid]]'));
	}

	var allowedStatus = ['online', 'offline', 'dnd', 'away'];
	if (allowedStatus.indexOf(status) === -1) {
		return callback(new Error('[[invalid-user-status]]'));
	}
	user.setUserField(socket.uid, 'status', status, function(err) {
		if (err) {
			return callback(err);
		}
		var data = {
			uid: socket.uid,
			status: status
		};
		websockets.server.sockets.emit('event:user_status_change', data);
		callback(null, data);
	});
};

/* Exports */

module.exports = SocketUser;
