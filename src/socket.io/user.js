'use strict';

var	async = require('async'),


	user = require('../user'),
	topics = require('../topics'),
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


require('./user/profile')(SocketUser);
require('./user/search')(SocketUser);
require('./user/status')(SocketUser);
require('./user/picture')(SocketUser);

SocketUser.exists = function(socket, data, callback) {
	if (data && data.username) {
		meta.userOrGroupExists(utils.slugify(data.username), callback);
	}
};

SocketUser.deleteAccount = function(socket, data, callback) {
	if (!socket.uid) {
		return;
	}
	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (err || isAdmin) {
			return callback(err || new Error('[[error:cant-delete-admin]]'));
		}

		socket.broadcast.emit('event:user_status_change', {uid: socket.uid, status: 'offline'});
		user.deleteAccount(socket.uid, function(err) {
			if (err) {
				return callback(err);
			}
			websockets.in('uid_' + socket.uid).emit('event:logout');
			callback();
		});
	});
};

SocketUser.emailExists = function(socket, data, callback) {
	if (data && data.email) {
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

			user.email.sendValidationEmail(socket.uid, email, callback);
		});
	}
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

SocketUser.follow = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return;
	}
	var userData;
	async.waterfall([
		function(next) {
			toggleFollow('follow', socket.uid, data.uid, next);
		},
		function(next) {
			user.getUserFields(socket.uid, ['username', 'userslug'], next);
		},
		function(_userData, next) {
			userData = _userData;
			notifications.create({
				bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
				nid: 'follow:' + data.uid + ':uid:' + socket.uid,
				from: socket.uid,
				path: '/user/' + userData.userslug
			}, next);
		},
		function(notification, next) {
			notification.user = userData;
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

SocketUser.saveSettings = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.isAdminOrSelf(socket.uid, data.uid, function(err) {
		if (err) {
			return callback(err);
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
	if (!data || !data.set || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!socket.uid && !!parseInt(meta.config.privateUserInfo, 10)) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	var start = parseInt(data.after, 10),
		stop = start + 19;

	async.parallel({
		isAdmin: function(next) {
			user.isAdministrator(socket.uid, next);
		},
		users: function(next) {
			user.getUsersFromSet(data.set, socket.uid, start, stop, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}


		if (!results.isAdmin && data.set === 'users:online') {
			results.users = results.users.filter(function(user) {
				return user.status !== 'offline';
			});
		}
		var result = {
			users: results.users,
			nextStart: stop + 1,
		};
		result['route_' + data.set] = true;
		callback(null, result);
	});
};

SocketUser.invite = function(socket, email, callback) {
	if (!email || !socket.uid) {
		return callback(new Error('[[error:invald-data]]'));
	}

	if (meta.config.registrationType !== 'invite-only') {
		return callback(new Error('[[error:forum-not-invite-only]]'));
	}

	user.sendInvitationEmail(socket.uid, email, callback);
};


module.exports = SocketUser;
