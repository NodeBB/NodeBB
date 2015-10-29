'use strict';

var async = require('async'),
	fs = require('fs'),
	nconf = require('nconf'),
	winston = require('winston'),

	db = require('../../database'),
	user = require('../../user'),
	meta = require('../../meta'),
	helpers = require('../helpers'),
	accountHelpers = require('./helpers');

var editController = {};

editController.get = function(req, res, callback) {
	accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, function(err, userData) {
		if (err || !userData) {
			return callback(err);
		}

		userData.title = '[[pages:account/edit, ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:edit]]'}]);

		res.render('account/edit', userData);
	});
};

editController.password = function(req, res, next) {
	renderRoute('password', req, res, next);
};

editController.username = function(req, res, next) {
	renderRoute('username', req, res, next);
};

editController.email = function(req, res, next) {
	renderRoute('email', req, res, next);
};

function renderRoute(name, req, res, next) {
	getUserData(req, next, function(err, userData) {
		if (err) {
			return next(err);
		}

		userData.title = '[[pages:account/edit/' + name + ', ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([
			{text: userData.username, url: '/user/' + userData.userslug},
			{text: '[[user:edit]]', url: '/user/' + userData.userslug + '/edit'},
			{text: '[[user:' + name + ']]'}
		]);

		res.render('account/edit/' + name, userData);
	});
}

function getUserData(req, next, callback) {
	var userData;
	async.waterfall([
		function(next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function(data, next) {
			userData = data;
			if (!userData) {
				return next();
			}
			db.getObjectField('user:' + userData.uid, 'password', next);
		}
	], function(err, password) {
		if (err) {
			return callback(err);
		}

		userData['username:disableEdit'] = parseInt(meta.config['username:disableEdit'], 10) === 1;
		userData.hasPassword = !!password;
		callback(null, userData);
	});
}

editController.uploadPicture = function (req, res, next) {
	var userPhoto = req.files.files[0];

	var updateUid = req.uid;

	async.waterfall([
		function(next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function(uid, next) {
			if (parseInt(updateUid, 10) === parseInt(uid, 10)) {
				return next();
			}

			user.isAdministrator(req.uid, function(err, isAdmin) {
				if (err) {
					return next(err);
				}

				if (!isAdmin) {
					return helpers.notAllowed(req, res);
				}
				updateUid = uid;
				next();
			});
		},
		function(next) {
			user.uploadPicture(updateUid, userPhoto, next);
		}
	], function(err, image) {
		fs.unlink(userPhoto.path, function(err) {
			winston.error('unable to delete picture ' + userPhoto.path, err);
		});
		if (err) {
			return next(err);
		}

		res.json([{name: userPhoto.name, url: image.url.startsWith('http') ? image.url : nconf.get('relative_path') + image.url}]);
	});
};

editController.uploadCoverPicture = function(req, res, next) {
	var params = JSON.parse(req.body.params);
	
	user.updateCoverPicture({
		file: req.files.files[0].path,
		uid: params.uid
	}, function(err, image) {
		if (err) {
			return next(err);
		}

		res.json([{url: image.url.startsWith('http') ? image.url : nconf.get('relative_path') + image.url}]);
	});
};

module.exports = editController;