'use strict';

var async = require('async');
var winston = require('winston');
var db = require('../database');
var meta = require('../meta');
var events = require('../events');

module.exports = function(User) {
	User.auth = {};

	User.auth.logAttempt = function(uid, ip, callback) {
		db.exists('lockout:' + uid, function(err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:account-locked]]'));
			}

			db.increment('loginAttempts:' + uid, function(err, attempts) {
				if (err) {
					return callback(err);
				}

				if ((meta.config.loginAttempts || 5) < attempts) {
					// Lock out the account
					db.set('lockout:' + uid, '', function(err) {
						if (err) {
							return callback(err);
						}
						var duration = 1000 * 60 * (meta.config.lockoutDuration || 60);

						db.delete('loginAttempts:' + uid);
						db.pexpire('lockout:' + uid, duration);
						events.log({
							type: 'account-locked',
							uid: uid,
							ip: ip
						});
						callback(new Error('[[error:account-locked]]'));
					});
				} else {
					db.pexpire('loginAttempts:' + uid, 1000 * 60 * 60);
					callback();
				}
			});
		});
	};

	User.auth.clearLoginAttempts = function(uid) {
		db.delete('loginAttempts:' + uid);
	};

	User.auth.resetLockout = function(uid, callback) {
		async.parallel([
			async.apply(db.delete, 'loginAttempts:' + uid),
			async.apply(db.delete, 'lockout:' + uid)
		], callback);
	};

	User.auth.getSessions = function(uid, curSessionId, callback) {
		var _sids;

		// curSessionId is optional
		if (arguments.length === 2 && typeof curSessionId === 'function') {
			callback = curSessionId;
			curSessionId = undefined;
		}

		async.waterfall([
			async.apply(db.getSortedSetRevRange, 'uid:' + uid + ':sessions', 0, -1),
			function (sids, next) {
				_sids = sids;
				async.map(sids, db.sessionStore.get.bind(db.sessionStore), next);
			},
			function (sessions, next) {
				sessions.forEach(function(sessionObj, idx) {
					if (sessionObj && sessionObj.meta) {
						sessionObj.meta.current = curSessionId === _sids[idx];
					}
				});

				// Revoke any sessions that have expired, return filtered list
				var expiredSids = [],
					expired;

				sessions = sessions.filter(function(sessionObj, idx) {
					expired = !sessionObj || !sessionObj.hasOwnProperty('passport') ||
						!sessionObj.passport.hasOwnProperty('user')	||
						parseInt(sessionObj.passport.user, 10) !== parseInt(uid, 10);

					if (expired) {
						expiredSids.push(_sids[idx]);
					}

					return !expired;
				});

				async.each(expiredSids, function(sid, next) {
					User.auth.revokeSession(sid, uid, next);
				}, function(err) {
					next(null, sessions);
				});
			}
		], function (err, sessions) {
			callback(err, sessions ? sessions.map(function(sessObj) {
				sessObj.meta.datetimeISO = new Date(sessObj.meta.datetime).toISOString();
				return sessObj.meta;
			}) : undefined);
		});
	};

	User.auth.addSession = function(uid, sessionId, callback) {
		callback = callback || function() {};
		db.sortedSetAdd('uid:' + uid + ':sessions', Date.now(), sessionId, callback);
	};

	User.auth.revokeSession = function(sessionId, uid, callback) {
		winston.verbose('[user.auth] Revoking session ' + sessionId + ' for user ' + uid);

		db.sessionStore.get(sessionId, function(err, sessionObj) {
			if (err) {
				return callback(err);
			}
			async.parallel([
				function (next) {
					if (sessionObj && sessionObj.meta && sessionObj.meta.uuid) {
						db.deleteObjectField('uid:' + uid + ':sessionUUID:sessionId', sessionObj.meta.uuid, next);
					} else {
						next();
					}
				},
				async.apply(db.sortedSetRemove, 'uid:' + uid + ':sessions', sessionId),
				async.apply(db.sessionStore.destroy.bind(db.sessionStore), sessionId)
			], callback);
		});
	};

	User.auth.revokeAllSessions = function(uid, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'uid:' + uid + ':sessions', 0, -1),
			function (sids, next) {
				async.each(sids, function(sid, next) {
					User.auth.revokeSession(sid, uid, next);
				}, next);
			}
		], callback);
	};
};