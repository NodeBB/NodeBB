'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');

var sessionController = {};

sessionController.revoke = function (req, res, next) {
	if (!req.params.hasOwnProperty('uuid')) {
		return next();
	}

	var _id;
	var uid = res.locals.uid;
	async.waterfall([
		function (next) {
			if (!uid) {
				return next(new Error('[[error:no-session-found]]'));
			}
			db.getSortedSetRange('uid:' + uid + ':sessions', 0, -1, next);
		},
		function (sids, done) {
			async.eachSeries(sids, function (sid, next) {
				db.sessionStore.get(sid, function (err, sessionObj) {
					if (err) {
						return next(err);
					}
					if (sessionObj && sessionObj.meta && sessionObj.meta.uuid === req.params.uuid) {
						_id = sid;
						done();
					} else {
						next();
					}
				});
			}, next);
		},
		function (next) {
			if (!_id) {
				return next(new Error('[[error:no-session-found]]'));
			}

			user.auth.revokeSession(_id, uid, next);
		},
	], function (err) {
		if (err) {
			return res.status(500).send(err.message);
		}
		return res.sendStatus(200);
	});
};

module.exports = sessionController;
