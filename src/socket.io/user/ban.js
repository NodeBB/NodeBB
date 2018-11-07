'use strict';

var async = require('async');
var winston = require('winston');

var db = require('../../database');
var user = require('../../user');
var meta = require('../../meta');
var websockets = require('../index');
var events = require('../../events');
var privileges = require('../../privileges');
var plugins = require('../../plugins');
var emailer = require('../../emailer');
var translator = require('../../translator');
var utils = require('../../../public/src/utils');

module.exports = function (SocketUser) {
	SocketUser.banUsers = function (socket, data, callback) {
		if (!data || !Array.isArray(data.uids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		toggleBan(socket.uid, data.uids, function (uid, next) {
			async.waterfall([
				function (next) {
					banUser(socket.uid, uid, data.until || 0, data.reason || '', next);
				},
				function (next) {
					events.log({
						type: 'user-ban',
						uid: socket.uid,
						targetUid: uid,
						ip: socket.ip,
						reason: data.reason || undefined,
					}, next);
				},
				function (next) {
					plugins.fireHook('action:user.banned', {
						callerUid: socket.uid,
						ip: socket.ip,
						uid: uid,
						until: data.until > 0 ? data.until : undefined,
						reason: data.reason || undefined,
					});
					next();
				},
				function (next) {
					user.auth.revokeAllSessions(uid, next);
				},
			], next);
		}, callback);
	};

	SocketUser.unbanUsers = function (socket, uids, callback) {
		toggleBan(socket.uid, uids, function (uid, next) {
			async.waterfall([
				function (next) {
					user.unban(uid, next);
				},
				function (next) {
					events.log({
						type: 'user-unban',
						uid: socket.uid,
						targetUid: uid,
						ip: socket.ip,
					}, next);
				},
				function (next) {
					plugins.fireHook('action:user.unbanned', {
						callerUid: socket.uid,
						ip: socket.ip,
						uid: uid,
					});
					next();
				},
			], next);
		}, callback);
	};

	function toggleBan(uid, uids, method, callback) {
		if (!Array.isArray(uids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				privileges.users.hasBanPrivilege(uid, next);
			},
			function (hasBanPrivilege, next) {
				if (!hasBanPrivilege) {
					return next(new Error('[[error:no-privileges]]'));
				}
				async.each(uids, method, next);
			},
		], callback);
	}

	function banUser(callerUid, uid, until, reason, callback) {
		async.waterfall([
			function (next) {
				user.isAdministrator(uid, next);
			},
			function (isAdmin, next) {
				if (isAdmin) {
					return next(new Error('[[error:cant-ban-other-admins]]'));
				}

				user.getUserField(uid, 'username', next);
			},
			function (username, next) {
				var siteTitle = meta.config.title || 'NodeBB';
				var data = {
					subject: '[[email:banned.subject, ' + siteTitle + ']]',
					username: username,
					until: until ? utils.toISOString(until) : false,
					reason: reason,
				};

				emailer.send('banned', uid, data, function (err) {
					if (err) {
						winston.error('[emailer.send] ' + err.message);
					}
					next();
				});
			},
			function (next) {
				user.ban(uid, until, reason, next);
			},
			function (banData, next) {
				db.setObjectField('uid:' + uid + ':ban:' + banData.timestamp, 'fromUid', callerUid, next);
			},
			function (next) {
				if (!reason) {
					return translator.translate('[[user:info.banned-no-reason]]', function (translated) {
						next(null, translated);
					});
				}

				next(null, reason);
			},
			function (_reason, next) {
				websockets.in('uid_' + uid).emit('event:banned', {
					until: until,
					reason: _reason,
				});
				next();
			},
		], callback);
	}
};
