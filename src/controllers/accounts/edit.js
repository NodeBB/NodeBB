'use strict';

var async = require('async');
var fs = require('fs');
var nconf = require('nconf');
var winston = require('winston');

var db = require('../../database');
var user = require('../../user');
var meta = require('../../meta');
var plugins = require('../../plugins');
var helpers = require('../helpers');
var groups = require('../../groups');
var accountHelpers = require('./helpers');

var editController = {};

editController.get = function(req, res, callback) {
	accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, function(err, userData) {
		if (err || !userData) {
			return callback(err);
		}

		userData.maximumSignatureLength = parseInt(meta.config.maximumSignatureLength, 10) || 255;
		userData.maximumAboutMeLength = parseInt(meta.config.maximumAboutMeLength, 10) || 1000;
		userData.maximumProfileImageSize = parseInt(meta.config.maximumProfileImageSize, 10);
		userData.allowProfileImageUploads = parseInt(meta.config.allowProfileImageUploads) === 1;
		userData.allowAccountDelete = parseInt(meta.config.allowAccountDelete, 10) === 1;

		userData.groups = userData.groups.filter(function(group) {
			return group && group.userTitleEnabled && !groups.isPrivilegeGroup(group.name) && group.name !== 'registered-users';
		});
		userData.groups.forEach(function(group) {
			group.selected = group.name === userData.groupTitle;
		});

		userData.title = '[[pages:account/edit, ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:edit]]'}]);
		userData.editButtons = [];

		plugins.fireHook('filter:user.account.edit', userData, function(err, userData) {
			if (err) {
				return callback(err);
			}

			res.render('account/edit', userData);
		});
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
		if ((name === 'username' && userData['username:disableEdit']) || (name === 'email' && userData['email:disableEdit'])) {
			return next();
		}

		if (name === 'password') {
			userData.minimumPasswordLength = parseInt(meta.config.minimumPasswordLength, 10);
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

		userData.hasPassword = !!password;
		callback(null, userData);
	});
}

editController.uploadPicture = function (req, res, next) {
	var userPhoto = req.files.files[0];

	var updateUid;

	async.waterfall([
		function(next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function(uid, next) {
			updateUid = uid;
			if (parseInt(req.uid, 10) === parseInt(uid, 10)) {
				return next(null, true);
			}

			user.isAdminOrGlobalMod(req.uid, next);
		},
		function(isAllowed, next) {
			if (!isAllowed) {
				return helpers.notAllowed(req, res);
			}

			user.uploadPicture(updateUid, userPhoto, next);
		}
	], function(err, image) {
		fs.unlink(userPhoto.path, function(err) {
			if (err) {
				winston.warn('[user/picture] Unable to delete picture ' + userPhoto.path, err);
			}
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
		file: req.files.files[0],
		uid: params.uid
	}, function(err, image) {
		if (err) {
			return next(err);
		}

		res.json([{ url: image.url }]);
	});
};

module.exports = editController;