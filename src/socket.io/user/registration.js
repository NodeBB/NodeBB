'use strict';

var async = require('async');
var user = require('../../user');
var events = require('../../events');

module.exports = function (SocketUser) {
	SocketUser.acceptRegistration = function (socket, data, callback) {
		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function (isAdminOrGlobalMod, next) {
				if (!isAdminOrGlobalMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				user.acceptRegistration(data.username, next);
			},
			function (uid, next) {
				events.log({
					type: 'registration-approved',
					uid: socket.uid,
					ip: socket.ip,
					targetUid: uid,
				});
				next(null, uid);
			},
		], callback);
	};

	SocketUser.rejectRegistration = function (socket, data, callback) {
		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function (isAdminOrGlobalMod, next) {
				if (!isAdminOrGlobalMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				user.rejectRegistration(data.username, next);
			},
			function (next) {
				events.log({
					type: 'registration-rejected',
					uid: socket.uid,
					ip: socket.ip,
					username: data.username,
				});
				next();
			},
		], callback);
	};

	SocketUser.deleteInvitation = function (socket, data, callback) {
		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function (isAdminOrGlobalMod, next) {
				if (!isAdminOrGlobalMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				user.deleteInvitation(data.invitedBy, data.email, next);
			},
		], callback);
	};
};
