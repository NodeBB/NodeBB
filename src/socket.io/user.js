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
	events = require('../events'),
	emailer = require('../emailer'),
	db = require('../database'),
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

SocketUser.search = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}
	user.search({
		query: data.query,
		page: data.page,
		searchBy: data.searchBy,
		sortBy: data.sortBy,
		filterBy: data.filterBy,
		uid: socket.uid
	}, callback);
};

// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(socket, email, callback) {
	if (email) {
		user.reset.send(email, callback);
	}
};

SocketUser.reset.commit = function(socket, data, callback) {
	if (!data || !data.code || !data.password) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		uid: async.apply(db.getObjectField, 'reset:uid', data.code),
		reset: async.apply(user.reset.commit, data.code, data.password)
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var uid = results.uid,
			now = new Date(),
			parsedDate = now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate();

		user.getUserField(uid, 'username', function(err, username) {
			emailer.send('reset_notify', uid, {
				username: username,
				date: parsedDate,
				site_title: meta.config.title || 'NodeBB',
				subject: '[[email:reset.notify.subject]]'
			});
		});

		events.log({
			type: 'password-reset',
			uid: uid,
			ip: socket.ip
		});
		callback();
	});
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
	if (!data || !data.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	if (!socket.uid) {
		return callback('[[error:invalid-uid]]');
	}

	user.changePassword(socket.uid, data, function(err) {
		if (err) {
			return callback(err);
		}

		events.log({
			type: 'password-change',
			uid: socket.uid,
			targetUid: data.uid,
			ip: socket.ip
		});
		callback();
	});
};

SocketUser.updateProfile = function(socket, data, callback) {
	function update(oldUserData) {
		function done(err, userData) {
			if (err) {
				return callback(err);
			}

			if (userData.email !== oldUserData.email) {
				events.log({
					type: 'email-change',
					uid: socket.uid,
					targetUid: data.uid,
					ip: socket.ip,
					oldEmail: oldUserData.email,
					newEmail: userData.email
				});
			}

			if (userData.username !== oldUserData.username) {
				events.log({
					type: 'username-change',
					uid: socket.uid,
					targetUid: data.uid,
					ip: socket.ip,
					oldUsername: oldUserData.username,
					newUsername: userData.username
				});
			}
			callback(null, userData);
		}

		if (socket.uid === parseInt(data.uid, 10)) {
			return user.updateProfile(socket.uid, data, done);
		}

		user.isAdministrator(socket.uid, function(err, isAdmin) {
			if (err || !isAdmin) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}

			user.updateProfile(data.uid, data, done);
		});
	}

	if (!socket.uid) {
		return callback('[[error:invalid-uid]]');
	}

	if (!data || !data.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.getUserFields(data.uid, ['email', 'username'], function(err, oldUserData) {
		if (err) {
			return callback(err);
		}

		update(oldUserData, callback);
	});
};

SocketUser.changePicture = function(socket, data, callback) {
	if (!socket.uid) {
		return callback('[[error:invalid-uid]]');
	}

	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var type = data.type;

	function changePicture(uid, callback) {
		user.getUserField(uid, type, function(err, picture) {
			if (err) {
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
		return callback(new Error('[[error:invalid-image-type, ' + ['gravatar', 'uploadedpicture'].join(', ') + ']]'));
	}

	if (socket.uid === parseInt(data.uid, 10)) {
		return changePicture(socket.uid, callback);
	}

	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (err || !isAdmin) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		changePicture(data.uid, callback);
	});
};

SocketUser.uploadProfileImageFromUrl = function(socket, url, callback) {
	if (!socket.uid || !url) {
		return;
	}

	plugins.fireHook('filter:uploadImage', {image: {url: url}, uid: socket.uid}, function(err, data) {
		if (err) {
			return callback(err);
		}

		user.setUserFields(socket.uid, {uploadedpicture: data.url, picture: data.url}, function(err) {
			callback(err, data.url);
		});
	});
};

SocketUser.follow = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return;
	}

	async.waterfall([
		function(next) {
			toggleFollow('follow', socket.uid, data.uid, next);
		},
		function(next) {
			user.getUserFields(socket.uid, ['username', 'userslug'], next);
		},
		function(userData, next) {
			notifications.create({
				bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
				nid: 'follow:' + data.uid + ':uid:' + socket.uid,
				from: socket.uid,
				user: userData
			}, next);
		},
		function(notification, next) {
			notifications.push(notification, [data.uid], next);
		}
	], callback);
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

SocketUser.setCategorySort = function(socket, sort, callback) {
	if (socket.uid) {
		user.setSetting(socket.uid, 'categoryTopicSort', sort, callback);
	}
};

SocketUser.getOnlineAnonCount = function(socket, data, callback) {
	callback(null, module.parent.exports.getOnlineAnonCount());
};

SocketUser.getUnreadCount = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(null, 0);
	}
	topics.getTotalUnread(socket.uid, callback);
};

SocketUser.getUnreadChatCount = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(null, 0);
	}
	messaging.getUnreadCount(socket.uid, callback);
};

SocketUser.loadMore = function(socket, data, callback) {
	if(!data || !data.set || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!socket.uid && !!parseInt(meta.config.privateUserInfo, 10)) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 19;

	user.getUsersFromSet(data.set, socket.uid, start, end, function(err, userData) {
		if (err) {
			return callback(err);
		}

		user.isAdministrator(socket.uid, function (err, isAdministrator) {
			if (err) {
				return callback(err);
			}

			if (!isAdministrator && data.set === 'users:online') {
				userData = userData.filter(function(item) {
					return item.status !== 'offline';
				});
			}

			callback(null, {
				users: userData,
				nextStart: end + 1
			});
		});
	});
};

SocketUser.setStatus = function(socket, status, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:invalid-uid]]'));
	}

	var allowedStatus = ['online', 'offline', 'dnd', 'away'];
	if (allowedStatus.indexOf(status) === -1) {
		return callback(new Error('[[error:invalid-user-status]]'));
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
