'use strict';

var user = require('../../user'),
	helpers = require('../helpers');


var notificationsController = {};

notificationsController.get = function(req, res, next) {
	user.notifications.getAll(req.uid, 0, 39, function(err, notifications) {
		if (err) {
			return next(err);
		}
		res.render('notifications', {
			notifications: notifications,
			nextStart: 40,
			title: '[[pages:notifications]]',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:notifications]]'}])
		});
	});
};


module.exports = notificationsController;
