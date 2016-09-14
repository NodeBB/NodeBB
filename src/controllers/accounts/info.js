'use strict';

var async = require('async');

var user = require('../../user');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var infoController = {};

infoController.get = function(req, res, callback) {
	var userData;
	async.waterfall([
		function(next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function(_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}
			async.parallel({
				history: async.apply(user.getModerationHistory, userData.uid),
				sessions: async.apply(user.auth.getSessions, userData.uid, req.sessionID)
			}, next);
		}
	], function(err, data) {
		if (err) {
			return callback(err);
		}

		userData.history = data.history;
		userData.sessions = data.sessions;
		userData.title = '[[pages:account/info]]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:account_info]]'}]);

		res.render('account/info', userData);
	});
};

module.exports = infoController;