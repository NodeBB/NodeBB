'use strict';

var async = require('async');
var winston = require('winston');

var user = require('../user');
var topics = require('../topics');
var notifications = require('../notifications');
var messaging = require('../messaging');
var plugins = require('../plugins');
var meta = require('../meta');
var events = require('../events');
var emailer = require('../emailer');
var db = require('../database');
var userController = require('../controllers/user');
var privileges = require('../privileges');

var SocketUser = module.exports;

require('./user/profile')(SocketUser);
require('./user/search')(SocketUser);
require('./user/status')(SocketUser);
require('./user/picture')(SocketUser);
require('./user/ban')(SocketUser);

SocketUser.exists = function (socket, data, callback) {
	if (!data || !data.username) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	meta.userOrGroupExists(data.username, callback);
};

SocketUser.deleteAccount = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	async.waterfall([
		function (next) {
			user.hasPassword(socket.uid, next);
		},
		function (hasPassword, next) {
			if (!hasPassword) {
				return next();
			}
			user.isPasswordCorrect(socket.uid, data.password, socket.ip, function (err, ok) {
				next(err || (!ok ? new Error('[[error:invalid-password]]') : undefined));
			});
		},
		function (next) {
			user.isAdministrator(socket.uid, next);
		},
		function (isAdmin, next) {
			if (isAdmin) {
				return next(new Error('[[error:cant-delete-admin]]'));
			}
			user.deleteAccount(socket.uid, next);
		},
		function (userData, next) {
			require('./index').server.sockets.emit('event:user_status_change', { uid: socket.uid, status: 'offline' });

			events.log({
				type: 'user-delete',
				uid: socket.uid,
				targetUid: socket.uid,
				ip: socket.ip,
				username: userData.username,
				email: userData.email,
			});
			next();
		},
	], callback);
};

SocketUser.emailExists = function (socket, data, callback) {
	if (!data || !data.email) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.email.exists(data.email, callback);
};

SocketUser.emailConfirm = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	if (parseInt(meta.config.requireEmailConfirmation, 10) !== 1) {
		return callback(new Error('[[error:email-confirmations-are-disabled]]'));
	}

	user.email.sendValidationEmail(socket.uid, callback);
};


// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = function (socket, email, callback) {
	if (!email) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.reset.send(email, function (err) {
		if (err) {
			switch (err.message) {
			case '[[error:invalid-email]]':
				winston.warn('[user/reset] Invalid email attempt: ' + email + ' by IP ' + socket.ip + (socket.uid ? ' (uid: ' + socket.uid + ')' : ''));
				err = null;
				break;

			case '[[error:reset-rate-limited]]':
				err = null;
				break;
			}
		}

		setTimeout(callback.bind(err), 2500);
	});
};

SocketUser.reset.commit = function (socket, data, callback) {
	if (!data || !data.code || !data.password) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var uid;
	async.waterfall([
		function (next) {
			async.parallel({
				uid: async.apply(db.getObjectField, 'reset:uid', data.code),
				reset: async.apply(user.reset.commit, data.code, data.password),
				hook: async.apply(plugins.fireHook, 'action:password.reset', { uid: socket.uid }),
			}, next);
		},
		function (results, next) {
			uid = results.uid;
			events.log({
				type: 'password-reset',
				uid: uid,
				ip: socket.ip,
			});

			user.getUserField(uid, 'username', next);
		},
		function (username, next) {
			var now = new Date();
			var parsedDate = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
			emailer.send('reset_notify', uid, {
				username: username,
				date: parsedDate,
				subject: '[[email:reset.notify.subject]]',
			});

			next();
		},
	], callback);
};

SocketUser.isFollowing = function (socket, data, callback) {
	if (!socket.uid || !data.uid) {
		return callback(null, false);
	}

	user.isFollowing(socket.uid, data.uid, callback);
};

SocketUser.follow = function (socket, data, callback) {
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
				type: 'follow',
				bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
				nid: 'follow:' + data.uid + ':uid:' + socket.uid,
				from: socket.uid,
				path: '/uid/' + data.uid + '/followers',
				mergeId: 'notifications:user_started_following_you',
			}, next);
		},
		function (notification, next) {
			if (!notification) {
				return next();
			}
			notification.user = userData;
			notifications.push(notification, [data.uid], next);
		},
	], callback);
};

SocketUser.unfollow = function (socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	toggleFollow('unfollow', socket.uid, data.uid, callback);
};

function toggleFollow(method, uid, theiruid, callback) {
	async.waterfall([
		function (next) {
			user[method](uid, theiruid, next);
		},
		function (next) {
			plugins.fireHook('action:user.' + method, {
				fromUid: uid,
				toUid: theiruid,
			});
			next();
		},
	], callback);
}

SocketUser.saveSettings = function (socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			privileges.users.canEdit(socket.uid, data.uid, next);
		},
		function (allowed, next) {
			if (!allowed) {
				return next(new Error('[[error:no-privileges]]'));
			}
			user.saveSettings(data.uid, data.settings, next);
		},
	], callback);
};

SocketUser.setTopicSort = function (socket, sort, callback) {
	user.setSetting(socket.uid, 'topicPostSort', sort, callback);
};

SocketUser.setCategorySort = function (socket, sort, callback) {
	user.setSetting(socket.uid, 'categoryTopicSort', sort, callback);
};

SocketUser.getUnreadCount = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(null, 0);
	}
	topics.getTotalUnread(socket.uid, callback);
};

SocketUser.getUnreadChatCount = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(null, 0);
	}
	messaging.getUnreadCount(socket.uid, callback);
};

SocketUser.getUnreadCounts = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(null, {});
	}
	async.parallel({
		unreadCounts: async.apply(topics.getUnreadTids, { uid: socket.uid, count: true }),
		unreadChatCount: async.apply(messaging.getUnreadCount, socket.uid),
		unreadNotificationCount: async.apply(user.notifications.getUnreadCount, socket.uid),
	}, function (err, results) {
		if (err) {
			return callback(err);
		}
		results.unreadTopicCount = results.unreadCounts[''];
		results.unreadNewTopicCount = results.unreadCounts.new;
		results.unreadWatchedTopicCount = results.unreadCounts.watched;
		results.unreadUnrepliedTopicCount = results.unreadCounts.unreplied;
		callback(null, results);
	});
};

SocketUser.invite = function (socket, email, callback) {
	if (!email || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var registrationType = meta.config.registrationType;

	if (registrationType !== 'invite-only' && registrationType !== 'admin-invite-only') {
		return callback(new Error('[[error:forum-not-invite-only]]'));
	}

	async.waterfall([
		function (next) {
			user.isAdministrator(socket.uid, next);
		},
		function (isAdmin, next) {
			if (registrationType === 'admin-invite-only' && !isAdmin) {
				return next(new Error('[[error:no-privileges]]'));
			}
			var max = parseInt(meta.config.maximumInvites, 10);
			email = email.split(',').map(email => email.trim()).filter(Boolean);
			async.eachSeries(email, function (email, next) {
				async.waterfall([
					function (next) {
						if (max) {
							user.getInvitesNumber(socket.uid, next);
						} else {
							next(null, 0);
						}
					},
					function (invites, next) {
						if (!isAdmin && max && invites >= max) {
							return next(new Error('[[error:invite-maximum-met, ' + invites + ', ' + max + ']]'));
						}

						user.sendInvitationEmail(socket.uid, email, next);
					},
				], next);
			}, next);
		},
	], callback);
};

SocketUser.getUserByUID = function (socket, uid, callback) {
	userController.getUserDataByField(socket.uid, 'uid', uid, callback);
};

SocketUser.getUserByUsername = function (socket, username, callback) {
	userController.getUserDataByField(socket.uid, 'username', username, callback);
};

SocketUser.getUserByEmail = function (socket, email, callback) {
	userController.getUserDataByField(socket.uid, 'email', email, callback);
};

SocketUser.setModerationNote = function (socket, data, callback) {
	if (!socket.uid || !data || !data.uid || !data.note) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			privileges.users.canEdit(socket.uid, data.uid, next);
		},
		function (allowed, next) {
			if (allowed) {
				return setImmediate(next, null, allowed);
			}

			user.isModeratorOfAnyCategory(socket.uid, next);
		},
		function (allowed, next) {
			if (!allowed) {
				return next(new Error('[[error:no-privileges]]'));
			}

			var note = {
				uid: socket.uid,
				note: data.note,
				timestamp: Date.now(),
			};
			db.sortedSetAdd('uid:' + data.uid + ':moderation:notes', note.timestamp, JSON.stringify(note), next);
		},
	], callback);
};

SocketUser.deleteUpload = function (socket, data, callback) {
	if (!data || !data.name || !data.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.deleteUpload(socket.uid, data.uid, data.name, callback);
};

SocketUser.gdpr = {};

SocketUser.gdpr.consent = function (socket, data, callback) {
	user.setUserField(socket.uid, 'gdpr_consent', 1, callback);
};

SocketUser.gdpr.check = function (socket, data, callback) {
	async.waterfall([
		async.apply(user.isAdministrator, socket.uid),
		function (isAdmin, next) {
			if (!isAdmin) {
				data.uid = socket.uid;
			}

			db.getObjectField('user:' + data.uid, 'gdpr_consent', next);
		},
	], callback);
};
