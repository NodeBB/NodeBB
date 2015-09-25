'use strict';

var user = require('../../user'),
	helpers = require('../helpers');


var notificationsController = {};

notificationsController.get = function(req, res, next) {
	user.notifications.getAll(req.uid, 40, function(err, notifications) {
		if (err) {
			return next(err);
		}
		res.render('notifications', {
			notifications: notifications,
			title: '[[pages:notifications]]',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:notifications]]'}])
		});
	});
};


module.exports = notificationsController;
