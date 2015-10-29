"use strict";

var async = require('async'),
	validator = require('validator'),
	nconf = require('nconf'),

	meta = require('../meta'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	helpers = require('./helpers'),
	widgets = require('../widgets');

var apiController = {};

apiController.getConfig = function(req, res, next) {
	function filterConfig() {
		plugins.fireHook('filter:config.get', config, function(err, config) {
			if (res.locals.isAPI) {
				res.status(200).json(config);
			} else {
				next(err, config);
			}
		});
	}

	var config = {};
	config.relative_path = nconf.get('relative_path');
	config.socketioTransports = nconf.get('socket.io:transports') || ['polling', 'websocket'];
	config.websocketAddress = nconf.get('socket.io:address') || '';
	config.version = nconf.get('version');
	config.siteTitle = validator.escape(meta.config.title || meta.config.browserTitle || 'NodeBB');
	config.browserTitle = validator.escape(meta.config.browserTitle || meta.config.title || 'NodeBB');
	config.titleLayout = (meta.config.titleLayout || '{pageTitle} | {browserTitle}').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
	config.showSiteTitle = parseInt(meta.config.showSiteTitle, 10) === 1;
	config.postDelay = meta.config.postDelay;
	config.minimumTitleLength = meta.config.minimumTitleLength;
	config.maximumTitleLength = meta.config.maximumTitleLength;
	config.minimumPostLength = meta.config.minimumPostLength;
	config.maximumPostLength = meta.config.maximumPostLength;
	config.topicStaleDays = parseInt(meta.config.topicStaleDays, 10) || 60;
	config.hasImageUploadPlugin = plugins.hasListeners('filter:uploadImage');
	config.maximumProfileImageSize = meta.config.maximumProfileImageSize;
	config.minimumUsernameLength = meta.config.minimumUsernameLength;
	config.maximumUsernameLength = meta.config.maximumUsernameLength;
	config.minimumPasswordLength = meta.config.minimumPasswordLength;
	config.maximumSignatureLength = meta.config.maximumSignatureLength;
	config.maximumAboutMeLength = meta.config.maximumAboutMeLength || 1000;
	config.useOutgoingLinksPage = parseInt(meta.config.useOutgoingLinksPage, 10) === 1;
	config.allowGuestSearching = parseInt(meta.config.allowGuestSearching, 10) === 1;
	config.allowGuestUserSearching = parseInt(meta.config.allowGuestUserSearching, 10) === 1;
	config.allowGuestHandles = parseInt(meta.config.allowGuestHandles, 10) === 1;
	config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
	config.allowProfileImageUploads = parseInt(meta.config.allowProfileImageUploads) === 1;
	config.allowTopicsThumbnail = parseInt(meta.config.allowTopicsThumbnail, 10) === 1;
	config.allowAccountDelete = parseInt(meta.config.allowAccountDelete, 10) === 1;
	config.privateUserInfo = parseInt(meta.config.privateUserInfo, 10) === 1;
	config.privateTagListing = parseInt(meta.config.privateTagListing, 10) === 1;
	config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
	config.disableSocialButtons = parseInt(meta.config.disableSocialButtons, 10) === 1;
	config.disableChat = parseInt(meta.config.disableChat, 10) === 1;
	config.maximumChatMessageLength = parseInt(meta.config.maximumChatMessageLength, 10) || 1000;
	config.maxReconnectionAttempts = meta.config.maxReconnectionAttempts || 5;
	config.reconnectionDelay = meta.config.reconnectionDelay || 1500;
	config.minimumTagsPerTopic = meta.config.minimumTagsPerTopic || 0;
	config.maximumTagsPerTopic = meta.config.maximumTagsPerTopic || 5;
	config.minimumTagLength = meta.config.minimumTagLength || 3;
	config.maximumTagLength = meta.config.maximumTagLength || 15;
	config.topicsPerPage = meta.config.topicsPerPage || 20;
	config.postsPerPage = meta.config.postsPerPage || 20;
	config.maximumFileSize = meta.config.maximumFileSize;
	config['theme:id'] = meta.config['theme:id'];
	config['theme:src'] = meta.config['theme:src'];
	config.defaultLang = meta.config.defaultLang || 'en_GB';
	config.userLang = req.query.lang || config.defaultLang;
	config.environment = process.env.NODE_ENV;
	config.loggedIn = !!req.user;
	config['cache-buster'] = meta.config['cache-buster'] || '';
	config.requireEmailConfirmation = parseInt(meta.config.requireEmailConfirmation, 10) === 1;
	config.topicPostSort = meta.config.topicPostSort || 'oldest_to_newest';
	config.categoryTopicSort = meta.config.categoryTopicSort || 'newest_to_oldest';
	config.csrf_token = req.csrfToken();
	config.searchEnabled = plugins.hasListeners('filter:search.query');
	config.bootswatchSkin = 'default';

	if (!req.user) {
		return filterConfig();
	}

	user.getSettings(req.user.uid, function(err, settings) {
		if (err) {
			return next(err);
		}

		config.usePagination = settings.usePagination;
		config.topicsPerPage = settings.topicsPerPage;
		config.postsPerPage = settings.postsPerPage;
		config.notificationSounds = settings.notificationSounds;
		config.userLang = req.query.lang || settings.userLang || config.defaultLang;
		config.openOutgoingLinksInNewTab = settings.openOutgoingLinksInNewTab;
		config.topicPostSort = settings.topicPostSort || config.topicPostSort;
		config.categoryTopicSort = settings.categoryTopicSort || config.categoryTopicSort;
		config.topicSearchEnabled = settings.topicSearchEnabled || false;
		config.bootswatchSkin = settings.bootswatchSkin || config.bootswatchSkin;

		filterConfig();
	});
};


apiController.renderWidgets = function(req, res, next) {
	var areas = {
		template: req.query.template,
		locations: req.query.locations,
		url: req.query.url
	};

	if (!areas.template || !areas.locations) {
		return res.status(200).json({});
	}

	widgets.render(req.uid,
		{
			template: areas.template,
			url: areas.url,
			locations: areas.locations,
		},
		req,
		res,
		function(err, widgets) {
		if (err) {
			return next(err);
		}
		res.status(200).json(widgets);
	});
};

apiController.getObject = function(req, res, next) {
	var methods = {
		post: {
			canRead: privileges.posts.can,
			data: posts.getPostData
		},
		topic: {
			canRead: privileges.topics.can,
			data: topics.getTopicData
		},
		category: {
			canRead: privileges.categories.can,
			data: categories.getCategoryData
		}
	};

	if (!methods[req.params.type]) {
		return next();
	}

	async.parallel({
		canRead: async.apply(methods[req.params.type].canRead, 'read', req.params.id, req.uid),
		data: async.apply(methods[req.params.type].data, req.params.id)
	}, function(err, results) {
		if (err || !results.data) {
			return next(err);
		}

		if (!results.canRead) {
			return helpers.notAllowed(req, res);
		}

		res.json(results.data);
	});
};


apiController.getUserByUID = function(req, res, next) {
	var uid = req.params.uid ? req.params.uid : 0;

	async.parallel({
		userData: async.apply(user.getUserData, uid),
		settings: async.apply(user.getSettings, uid)
	}, function(err, results) {
		if (err || !results.userData) {
			return next(err);
		}

		results.userData.email = results.settings.showemail ? results.userData.email : undefined;
		results.userData.fullname = results.settings.showfullname ? results.userData.fullname : undefined;

		res.json(results.userData);
	});
};


apiController.getModerators = function(req, res, next) {
	categories.getModerators(req.params.cid, function(err, moderators) {
		if (err) {
			return next(err);
		}
		res.json({moderators: moderators});
	});
};


apiController.getRecentPosts = function(req, res, next) {
	posts.getRecentPosts(req.uid, 0, 19, req.params.term, function (err, data) {
		if (err) {
			return next(err);
		}

		res.json(data);
	});
};

module.exports = apiController;
