'use strict';

var async = require('async');
var _ = require('underscore');

var user = require('../../user');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var infoController = {};

infoController.get = function(req, res, next) {
	accountHelpers.getBaseUser(req.params.userslug, req.uid, function(err, userData) {
		if (err) {
			return next(err);
		}

		async.parallel({
			ips: async.apply(user.getIPs, res.locals.uid, 4),
			history: async.apply(user.getModerationHistory, res.locals.uid),
			fields: async.apply(user.getUserFields, res.locals.uid, ['banned']),
			sessions: async.apply(user.auth.getSessions, userData.uid, req.sessionID)
		}, function(err, data) {
			if (err) {
				return next(err);
			}

			userData = _.extend(userData, {
				ips: data.ips,
				history: data.history
			}, data.fields);
			
			userData.sessions = data.sessions;
			userData.title = '[[pages:account/info]]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:settings]]'}]);

			res.render('account/info', userData);
		});
	});
};

module.exports = infoController;