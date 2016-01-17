'use strict';

var async = require('async'),

	user = require('../../user'),
	db = require('../../database');

var sessionController = {};

sessionController.revoke = function(req, res, next) {
	if (!req.params.hasOwnProperty('uuid')) {
		return next();
	}

	var _id;

	async.waterfall([
		async.apply(db.getObjectField, 'uid:' + req.uid + ':sessionUUID:sessionId', req.params.uuid),
		function(sessionId, next) {
			if (!sessionId) {
				return next(new Error('[[error:no-session-found]]'));
			}

			_id = sessionId;
			db.isSortedSetMember('uid:' + req.uid + ':sessions', sessionId, next)
		},
		function(isMember, next) {
			if (isMember) {
				user.auth.revokeSession(_id, req.uid, next);
			} else {
				next(new Error('[[error:no-session-found]]'));
			}
		}
	], function(err) {
		if (err) {
			return res.status(500).send(err.message);
		} else {
			return res.sendStatus(200);
		}
	});
};

module.exports = sessionController;