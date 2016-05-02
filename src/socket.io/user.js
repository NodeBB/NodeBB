'use strict';

var	async = require('async');


var user = require('../user');
var topics = require('../topics');
var notifications = require('../notifications');
var messaging = require('../messaging');
var plugins = require('../plugins');
var meta = require('../meta');
var events = require('../events');
var emailer = require('../emailer');
var db = require('../database');
var apiController = require('../controllers/api');

var SocketUser = {};

require('./user/profile')(SocketUser);
require('./user/search')(SocketUser);
require('./user/status')(SocketUser);
require('./user/picture')(SocketUser);
require('./user/ban')(SocketUser);

SocketUser.exists = function(socket, data, callback) {
	if (!data || !data.username) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	meta.userOrGroupExists(data.username, callback);
};

SocketUser.deleteAccount = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	async.waterfall([
		function (next) {
			user.isAdministrator(socket.uid, next);
		},
		function (isAdmin, next) {
			if (isAdmin) {
				return next(new Error('[[error:cant-delete-admin]]'));
			}
			user.deleteAccount(socket.uid, next);
		},
		function (next) {
			socket.broadcast.emit('event:user_status_change', {uid: socket.uid, status: 'offline'});

			events.log({
				type: 'user-delete',
				uid: socket.uid,
				targetUid: socket.uid,
				ip: socket.ip
			});
			next();
		}
	], callback);
};

SocketUser.emailExists = function(socket, data, callback) {
	if (!data || !data.email) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.email.exists(data.email, callback);
};

SocketUser.emailConfirm = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	if (parseInt(meta.config.requireEmailConfirmation, 10) !== 1) {
		callback();
	}
	user.getUserField(socket.uid, 'email', function(err, email) {
		if (err || !email) {
			return callback(err);
		}

		user.email.sendValidationEmail(socket.uid, email, callback);
	});
};


// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function(socket, email, callback) {
	if (!email) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.reset.send(email, callback);
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

		var uid = results.uid;
		var now = new Date();
		var parsedDate = now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate();

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

SocketUser.isFollowing = function(socket, data, callback) {
	if (!socket.uid || !data.uid) {
		return callback(null, false);
	}

	user.isFollowing(socket.uid, data.uid, callback);
};

SocketUser.follow = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var userData;
	async.waterfall([
		function (next) {
			toggleFollow('follow', socket.uid, data.uid, next);
		},
		function (next) {
			user.getUserFields(socket.uid, ['username', 'userslug'], next);
		},
		function (_userData, next) {
			userData = _userData;
			notifications.create({
				bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
				nid: 'follow:' + data.uid + ':uid:' + socket.uid,
				from: socket.uid,
				path: '/user/' + userData.userslug,
				mergeId: 'notifications:user_started_following_you'
			}, next);
		},
		function (notification, next) {
			if (!notification) {
				return next();
			}
			notification.user = userData;
			notifications.push(notification, [data.uid], next);
		}
	], callback);
};

SocketUser.unfollow = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	toggleFollow('unfollow', socket.uid, data.uid, callback);
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

	async.waterfall([
		function(next) {
			if (socket.uid === parseInt(data.uid, 10)) {
				return next(null, true);
			}
			user.isAdminOrGlobalMod(socket.uid, next);
		},
		function(allowed, next) {
			if (!allowed) {
				return next(new Error('[[error:no-privileges]]'));
			}
			user.saveSettings(data.uid, data.settings, next);
		}
	], callback);
};

SocketUser.setTopicSort = function(socket, sort, callback) {
	if (!socket.uid) {
		return callback();
	}
	user.setSetting(socket.uid, 'topicPostSort', sort, callback);
};

SocketUser.setCategorySort = function(socket, sort, callback) {
	if (!socket.uid) {
		return callback();
	}
	user.setSetting(socket.uid, 'categoryTopicSort', sort, callback);
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

SocketUser.getUnreadCounts = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(null, {});
	}
	async.parallel({
		unreadTopicCount: async.apply(topics.getTotalUnread, socket.uid),
		unreadNewTopicCount: async.apply(topics.getTotalUnread, socket.uid, 'new'),
		unreadChatCount: async.apply(messaging.getUnreadCount, socket.uid),
		unreadNotificationCount: async.apply(user.notifications.getUnreadCount, socket.uid)
	}, callback);
};

SocketUser.loadMore = function(socket, data, callback) {
	if (!data || !data.set || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!socket.uid && !!parseInt(meta.config.privateUserInfo, 10)) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	var start = parseInt(data.after, 10);
	var stop = start + 19;

	async.parallel({
		isAdmin: function(next) {
			user.isAdministrator(socket.uid, next);
		},
		isGlobalMod: function(next) {
			user.isGlobalModerator(socket.uid, next);
		},
		users: function(next) {
			user.getUsersFromSet(data.set, socket.uid, start, stop, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (data.set === 'users:banned' && !results.isAdmin && !results.isGlobalMod) {
			return callback(new Error('[[error:no-privileges]]'));
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
		return callback(new Error('[[error:invalid-data]]'));
	}

	var registrationType = meta.config.registrationType;

	if (registrationType !== 'invite-only' && registrationType !== 'admin-invite-only') {
		return callback(new Error('[[error:forum-not-invite-only]]'));
	}

	var max = meta.config.maximumInvites;

	user.isAdministrator(socket.uid, function(err, admin) {
		if (err) {
			return callback(err);
		}
		if (registrationType === 'admin-invite-only' && !admin) {
			return callback(new Error('[[error:no-privileges]]'));
		}
		if (max) {
			async.waterfall([
				function(next) {
					user.getInvitesNumber(socket.uid, next);
				},
				function(invites, next) {
					if (!admin && invites > max) {
						return next(new Error('[[error:invite-maximum-met, ' + invites + ', ' + max + ']]'));
					}
					next();
				},
				function(next) {
					user.sendInvitationEmail(socket.uid, email, next);
				}
			], callback);
		} else {
			user.sendInvitationEmail(socket.uid, email, callback);
		}
	});

};

SocketUser.getUserByUID = function(socket, uid, callback) {
	apiController.getUserDataByField(socket.uid, 'uid', uid, callback);
};

SocketUser.getUserByUsername = function(socket, username, callback) {
	apiController.getUserDataByField(socket.uid, 'username', username, callback);
};

SocketUser.getUserByEmail = function(socket, email, callback) {
	apiController.getUserDataByField(socket.uid, 'email', email, callback);
};


module.exports = SocketUser;
