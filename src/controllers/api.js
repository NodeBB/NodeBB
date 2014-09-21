"use strict";

var pkg = require('./../../package.json'),
	meta = require('./../meta'),
	user = require('./../user'),
	plugins = require('./../plugins'),
	widgets = require('../widgets');

var apiController = {};

apiController.getConfig = function(req, res, next) {
	var serverConfig = require('./../../config.json');

	var config = {};
	config.relative_path = serverConfig.relative_path;
	config.version = pkg.version;
	config.siteTitle = meta.config.title || meta.config.browserTitle || 'NodeBB';
	config.showSiteTitle = meta.config.showSiteTitle === '1';
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
	config.allowGuestSearching = parseInt(meta.config.allowGuestSearching, 10) === 1;
	config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
	config.allowTopicsThumbnail = parseInt(meta.config.allowTopicsThumbnail, 10) === 1;
	config.allowAccountDelete = parseInt(meta.config.allowAccountDelete, 10) === 1;
	config.privateUserInfo = parseInt(meta.config.privateUserInfo, 10) === 1;
	config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
	config.disableSocialButtons = parseInt(meta.config.disableSocialButtons, 10) === 1;
	config.maxReconnectionAttempts = meta.config.maxReconnectionAttempts || 5;
	config.reconnectionDelay = meta.config.reconnectionDelay || 200;
	config.websocketAddress = meta.config.websocketAddress || '';
	config.tagsPerTopic = meta.config.tagsPerTopic || 5;
	config.topicsPerPage = meta.config.topicsPerPage || 20;
	config.postsPerPage = meta.config.postsPerPage || 20;
	config.maximumFileSize = meta.config.maximumFileSize;
	config['theme:id'] = meta.config['theme:id'];
	config.defaultLang = meta.config.defaultLang || 'en_GB';
	config.userLang = config.defaultLang;
	config.environment = process.env.NODE_ENV;
	config.loggedIn = !!req.user;
	config['cache-buster'] = meta.config['cache-buster'] || '';
	config['script-buster'] = meta.js.hash;
	config['css-buster'] = meta.css.hash;
	config.requireEmailConfirmation = parseInt(meta.config.requireEmailConfirmation, 10) === 1;
	config.topicPostSort = meta.config.topicPostSort || 'oldest_to_newest';

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
		config.userLang = settings.language || config.defaultLang;
		config.openOutgoingLinksInNewTab = settings.openOutgoingLinksInNewTab;
		config.topicPostSort = settings.topicPostSort || config.topicPostSort;

		if (res.locals.isAPI) {
			res.json(200, config);
		} else {
			next(err, config);
		}
	});

};


apiController.renderWidgets = function(req, res, next) {
	var async = require('async'),
		uid = req.user ? req.user.uid : 0,
		areas = {
			template: req.query.template,
			locations: req.query.locations,
			url: req.query.url
		},
		renderedWidgets = [];

	if (!areas.template || !areas.locations) {
		return res.json(200, {});
	}

	widgets.render(uid, {
		template: areas.template,
		url: areas.url,
		locations: areas.locations
	}, function(err, widgets) {
		if (err) {
			return next(err);
		}
		res.json(200, widgets);
	});
};

module.exports = apiController;
