'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var meta = require('../../meta');
var plugins = require('../../plugins');
var helpers = require('../helpers');
var groups = require('../../groups');
var accountHelpers = require('./helpers');
var privileges = require('../../privileges');
var file = require('../../file');

var editController = module.exports;

editController.get = function (req, res, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				userData: function (next) {
					accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
				},
				canUseSignature: function (next) {
					privileges.global.can('signature', req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			var userData = results.userData;
			if (!userData) {
				return callback();
			}
			userData.maximumSignatureLength = meta.config.maximumSignatureLength;
			userData.maximumAboutMeLength = meta.config.maximumAboutMeLength;
			userData.maximumProfileImageSize = meta.config.maximumProfileImageSize;
			userData.allowProfilePicture = !userData.isSelf || userData.reputation >= meta.config['min:rep:profile-picture'];
			userData.allowCoverPicture = !userData.isSelf || userData.reputation >= meta.config['min:rep:cover-picture'];
			userData.allowProfileImageUploads = meta.config.allowProfileImageUploads;
			userData.allowMultipleBadges = meta.config.allowMultipleBadges === 1;
			userData.allowAccountDelete = meta.config.allowAccountDelete === 1;
			userData.allowWebsite = !userData.isSelf || userData.reputation >= meta.config['min:rep:website'];
			userData.allowAboutMe = !userData.isSelf || userData.reputation >= meta.config['min:rep:aboutme'];
			userData.allowSignature = results.canUseSignature && (!userData.isSelf || userData.reputation >= meta.config['min:rep:signature']);
			userData.profileImageDimension = meta.config.profileImageDimension;
			userData.defaultAvatar = user.getDefaultAvatar();

			userData.groups = userData.groups.filter(function (group) {
				return group && group.userTitleEnabled && !groups.isPrivilegeGroup(group.name) && group.name !== 'registered-users';
			});

			if (!userData.allowMultipleBadges) {
				userData.groupTitle = userData.groupTitleArray[0];
			}
			userData.groups.forEach(function (group) {
				group.selected = userData.groupTitleArray.includes(group.name);
			});

			userData.title = '[[pages:account/edit, ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([
				{
					text: userData.username,
					url: '/user/' + userData.userslug,
				},
				{
					text: '[[user:edit]]',
				},
			]);
			userData.editButtons = [];

			plugins.fireHook('filter:user.account.edit', userData, next);
		},
		function (userData) {
			res.render('account/edit', userData);
		},
	], callback);
};

editController.password = function (req, res, next) {
	renderRoute('password', req, res, next);
};

editController.username = function (req, res, next) {
	renderRoute('username', req, res, next);
};

editController.email = function (req, res, next) {
	renderRoute('email', req, res, next);
};

function renderRoute(name, req, res, next) {
	async.waterfall([
		function (next) {
			getUserData(req, next, next);
		},
		function (userData) {
			if (!userData) {
				return next();
			}

			if ((name === 'username' && userData['username:disableEdit']) || (name === 'email' && userData['email:disableEdit'])) {
				return next();
			}

			if (name === 'password') {
				userData.minimumPasswordLength = meta.config.minimumPasswordLength;
				userData.minimumPasswordStrength = meta.config.minimumPasswordStrength;
			}

			userData.title = '[[pages:account/edit/' + name + ', ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([
				{
					text: userData.username,
					url: '/user/' + userData.userslug,
				},
				{
					text: '[[user:edit]]',
					url: '/user/' + userData.userslug + '/edit',
				},
				{
					text: '[[user:' + name + ']]',
				},
			]);

			res.render('account/edit/' + name, userData);
		},
	], next);
}

function getUserData(req, next, callback) {
	var userData;
	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (data, next) {
			userData = data;
			if (!userData) {
				return callback(null, null);
			}
			db.getObjectField('user:' + userData.uid, 'password', next);
		},
		function (password, next) {
			userData.hasPassword = !!password;
			next(null, userData);
		},
	], callback);
}

editController.uploadPicture = function (req, res, next) {
	var userPhoto = req.files.files[0];

	var updateUid;

	async.waterfall([
		function (next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function (uid, next) {
			updateUid = uid;

			privileges.users.canEdit(req.uid, uid, next);
		},
		function (isAllowed, next) {
			if (!isAllowed) {
				return helpers.notAllowed(req, res);
			}
			user.checkMinReputation(req.uid, updateUid, 'min:rep:profile-picture', next);
		},
		function (next) {
			user.uploadCroppedPicture({
				uid: updateUid,
				file: userPhoto,
			}, next);
		},
	], function (err, image) {
		file.delete(userPhoto.path);
		if (err) {
			return next(err);
		}

		res.json([{
			name: userPhoto.name,
			url: image.url,
		}]);
	});
};

editController.uploadCoverPicture = function (req, res, next) {
	var params = JSON.parse(req.body.params);
	var coverPhoto = req.files.files[0];

	async.waterfall([
		function (next) {
			user.checkMinReputation(req.uid, params.uid, 'min:rep:cover-picture', next);
		},
		function (next) {
			user.updateCoverPicture({
				file: coverPhoto,
				uid: params.uid,
			}, next);
		},
	], function (err, image) {
		file.delete(coverPhoto.path);
		if (err) {
			return next(err);
		}
		res.json([{
			url: image.url,
		}]);
	});
};
