"use strict";

var pkg = require('./../../package.json'),
	meta = require('./../meta'),
	user = require('./../user'),
	plugins = require('./../plugins');

var apiController = {};

apiController.getConfig = function(req, res, next) {
	var serverConfig = require('./../../config.json');

	var config = {};
	config.relative_path = serverConfig.relative_path;
	config.version = pkg.version;
	config.postDelay = meta.config.postDelay;
	config.minimumTitleLength = meta.config.minimumTitleLength;
	config.maximumTitleLength = meta.config.maximumTitleLength;
	config.minimumPostLength = meta.config.minimumPostLength;
	config.hasImageUploadPlugin = plugins.hasListeners('filter:uploadImage');
	config.maximumProfileImageSize = meta.config.maximumProfileImageSize;
	config.minimumUsernameLength = meta.config.minimumUsernameLength;
	config.maximumUsernameLength = meta.config.maximumUsernameLength;
	config.minimumPasswordLength = meta.config.minimumPasswordLength;
	config.maximumSignatureLength = meta.config.maximumSignatureLength;
	config.useOutgoingLinksPage = parseInt(meta.config.useOutgoingLinksPage, 10) === 1;
	config.allowGuestPosting = parseInt(meta.config.allowGuestPosting, 10) === 1;
	config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
	config.allowTopicsThumbnail = parseInt(meta.config.allowTopicsThumbnail, 10) === 1;
	config.privateUserInfo = parseInt(meta.config.privateUserInfo, 10) === 1;
	config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
	config.disableSocialButtons = parseInt(meta.config.disableSocialButtons, 10) === 1;
	config.maxReconnectionAttempts = meta.config.maxReconnectionAttempts || 5;
	config.reconnectionDelay = meta.config.reconnectionDelay || 200;
	config.topicsPerPage = meta.config.topicsPerPage || 20;
	config.postsPerPage = meta.config.postsPerPage || 20;
	config.maximumFileSize = meta.config.maximumFileSize;
	config['theme:id'] = meta.config['theme:id'];
	config.defaultLang = meta.config.defaultLang || 'en_GB';
	config.environment = process.env.NODE_ENV;
	config.isLoggedIn = !!req.user;

	if (!req.user) {
		if (res.locals.isAPI) {
			res.json(200, config);
		} else {
			next(null, config);
		}
		return;
	}

	user.getSettings(req.user.uid, function(err, settings) {
		if (err) {
			return next(err);
		}

		config.usePagination = settings.usePagination;
		config.topicsPerPage = settings.topicsPerPage;
		config.postsPerPage = settings.postsPerPage;
		config.notificationSounds = settings.notificationSounds;
		config.defaultLang = settings.language || config.defaultLang;

		if (res.locals.isAPI) {
			res.json(200, config);
		} else {
			next(err, config);
		}
	});

};


module.exports = apiController;