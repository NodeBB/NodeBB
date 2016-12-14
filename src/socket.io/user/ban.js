'use strict';

var async = require('async');
var user = require('../../user');
var websockets = require('../index');
var events = require('../../events');

var plugins = require('../../plugins');

module.exports = function (SocketUser) {

	SocketUser.banUsers = function (socket, data, callback) {
		if (!data || !Array.isArray(data.uids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		toggleBan(socket.uid, data.uids, function (uid, next) {
			async.waterfall([
				function (next) {
					banUser(uid, data.until || 0, data.reason || '', next);
				},
				function (next) {
					events.log({
						type: 'user-ban',
						uid: socket.uid,
						targetUid: uid,
						ip: socket.ip
					}, next);
				},
				function (next) {
					plugins.fireHook('action:user.banned', {
						callerUid: socket.uid,
						ip: socket.ip,
						uid: uid,
						until: data.until > 0 ? data.until : undefined
					});
					next();
				}
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
						ip: socket.ip
					}, next);
				},
				function (next) {
					plugins.fireHook('action:user.unbanned', {
						callerUid: socket.uid,
						ip: socket.ip,
						uid: uid
					});
					next();
				}
			], next);
		}, callback);
	};

	function toggleBan(uid, uids, method, callback) {
		if (!Array.isArray(uids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(uid, next);
			},
			function (isAdminOrGlobalMod, next) {
				if (!isAdminOrGlobalMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				async.each(uids, method, next);
			}
		], callback);
	}

	function banUser(uid, until, reason, callback) {
		async.waterfall([
			function (next) {
				user.isAdministrator(uid, next);
			},
			function (isAdmin, next) {
				if (isAdmin) {
					return next(new Error('[[error:cant-ban-other-admins]]'));
				}
				user.ban(uid, until, reason, next);
			},
			function (next) {
				websockets.in('uid_' + uid).emit('event:banned');
				next();
			}
		], callback);
	}
};

