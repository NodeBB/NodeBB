'use strict';

var async = require('async'),
	db = require('../../database'),
	meta = require('../../meta'),
	helpers = require('../helpers'),
	accountHelpers = require('./helpers');

var editController = {};

editController.get = function(req, res, callback) {
	var userData;
	async.waterfall([
		function(next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function(data, next) {
			userData = data;
			if (!userData) {
				return callback();
			}
			db.getObjectField('user:' + userData.uid, 'password', next);
		}
	], function(err, password) {
		if (err) {
			return callback(err);
		}

		userData['username:disableEdit'] = parseInt(meta.config['username:disableEdit'], 10) === 1;
		userData.hasPassword = !!password;
		userData.title = '[[pages:account/edit, ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:edit]]'}]);

		res.render('account/edit', userData);
	});
};

module.exports = editController;