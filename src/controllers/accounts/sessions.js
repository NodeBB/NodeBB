'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var sessionController = module.exports;

sessionController.get = function (req, res, callback) {
	var userData;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			user.auth.getSessions(userData.uid, req.sessionID, next);
		},
		function (sessions) {
			userData.sessions = sessions;

			userData.title = '[[pages:account/sessions]]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[pages:account/sessions]]' }]);

			res.render('account/sessions', userData);
		},
	], callback);
};

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
