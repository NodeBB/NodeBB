'use strict';

var async = require('async'),
	_ = require('underscore'),

	user = require('../../user'),
	helpers = require('../helpers'),
	accountHelpers = require('./helpers');

var infoController = {};

infoController.get = function(req, res, next) {
	accountHelpers.getBaseUser(req.params.userslug, req.uid, function(err, userData) {
		async.parallel({
			ips: async.apply(user.getIPs, res.locals.uid, 4),
			history: async.apply(user.getModerationHistory, res.locals.uid),
			fields: async.apply(user.getUserFields, res.locals.uid, ['banned'])
		}, function(err, data) {
			data = _.extend(userData, {
				ips: data.ips,
				history: data.history
			}, data.fields);

			userData.title = '[[pages:account/info]]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:settings]]'}]);

			res.render('account/info', data);
		});
	});
};

module.exports = infoController;