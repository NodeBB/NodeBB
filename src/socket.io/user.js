'use strict';

var	async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
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

SocketUser.search = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	if (!socket.uid && parseInt(meta.config.allowGuestUserSearching, 10) !== 1) {
		return callback(new Error('[[error:not-logged-in]]'));
	}
	user.search({
		query: data.query,
		page: data.page,
		searchBy: data.searchBy,
		sortBy: data.sortBy,
		onlineOnly: data.onlineOnly,
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
	if (!data || !data.uid || data.newPassword.length < meta.config.minimumPasswordLength) {
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

function isAdminOrSelf(socket, uid, callback) {
	if (socket.uid === parseInt(uid, 10)) {
		return callback();
	}
	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (err || !isAdmin) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}
		callback();
	});
}

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

		isAdminOrSelf(socket, data.uid, function(err) {
			if (err) {
				return callback(err);
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

	if (type === 'gravatar') {
		type = 'gravatarpicture';
	} else if (type === 'uploaded') {
		type = 'uploadedpicture';
	} else {
		return callback(new Error('[[error:invalid-image-type, ' + ['gravatar', 'uploadedpicture'].join(', ') + ']]'));
	}

	async.waterfall([
		function (next) {
			isAdminOrSelf(socket, data.uid, next);
		},
		function (next) {
			user.getUserField(data.uid, type, next);
		},
		function (picture, next) {
			user.setUserField(data.uid, 'picture', picture, next);
		}
	], callback);
};

SocketUser.uploadProfileImageFromUrl = function(socket, data, callback) {
	if (!socket.uid || !data.url || !data.uid) {
		return;
	}

	isAdminOrSelf(socket, data.uid, function(err) {
		if (err) {
			return callback(err);
		}
		user.uploadFromUrl(data.uid, data.url, function(err, uploadedImage) {
			callback(err, uploadedImage ? uploadedImage.url : null);
		});
	});
};

SocketUser.removeUploadedPicture = function(socket, data, callback) {
	if (!socket.uid || !data.uid) {
		return;
	}

	async.waterfall([
		function (next) {
			isAdminOrSelf(socket, data.uid, next);
		},
		function (next) {
			user.getUserField(data.uid, 'uploadedpicture', next);
		},
		function(uploadedPicture, next) {
			if (!uploadedPicture.startsWith('http')) {
				require('fs').unlink(uploadedPicture, function(err) {
					if (err) {
						winston.error(err);
					}
				});
			}
			user.setUserField(data.uid, 'uploadedpicture', '', next);
		},
		function(next) {
			user.getUserField(data.uid, 'picture', next);
		}
	], callback);
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

	isAdminOrSelf(socket, data.uid, function(err) {
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

SocketUser.loadSearchPage = function(socket, data, callback) {
	function done(err, result) {
		if (err) {
			return callback(err);
		}
		var pageCount = Math.ceil(result.count / resultsPerPage);
		var userData = {
			matchCount: result.users.length,
			timing: (process.elapsedTimeSince(startTime) / 1000).toFixed(2),
			users: result.users,
			pagination: pagination.create(data.page, pageCount),
			pageCount: pageCount
		};

		callback(null, userData);
	}

	if (!data || !data.page) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var startTime = process.hrtime();
	var controllers = require('../controllers/users');
	var pagination = require('../pagination');

	var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;
	var start = Math.max(0, data.page - 1) * resultsPerPage;
	var stop = start + resultsPerPage - 1;
	if (data.onlineOnly) {
		async.parallel({
			users: function(next) {
				user.getUsersFromSet('users:online', socket.uid, 0, 49, next);
			},
			count: function(next) {
				var now = Date.now();
				db.sortedSetCount('users:online', now - 300000, now, next);
			}
		}, done);
	} else {
		controllers.getUsersAndCount('users:joindate', socket.uid, start, stop, done);
	}
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
