"use strict";

var async = require('async');
var validator = require('validator');
var nconf = require('nconf');

var meta = require('../meta');
var user = require('../user');
var posts = require('../posts');
var topics = require('../topics');
var categories = require('../categories');
var privileges = require('../privileges');
var plugins = require('../plugins');
var widgets = require('../widgets');

var apiController = {};

apiController.getConfig = function(req, res, next) {
	var config = {};
	config.environment = process.env.NODE_ENV;
	config.relative_path = nconf.get('relative_path');
	config.version = nconf.get('version');
	config.siteTitle = validator.escape(meta.config.title || meta.config.browserTitle || 'NodeBB');
	config.browserTitle = validator.escape(meta.config.browserTitle || meta.config.title || 'NodeBB');
	config.titleLayout = (meta.config.titleLayout || '{pageTitle} | {browserTitle}').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
	config.showSiteTitle = parseInt(meta.config.showSiteTitle, 10) === 1;
	config.minimumTitleLength = meta.config.minimumTitleLength;
	config.maximumTitleLength = meta.config.maximumTitleLength;
	config.minimumPostLength = meta.config.minimumPostLength;
	config.maximumPostLength = meta.config.maximumPostLength;
	config.minimumTagsPerTopic = meta.config.minimumTagsPerTopic || 0;
	config.maximumTagsPerTopic = meta.config.maximumTagsPerTopic || 5;
	config.minimumTagLength = meta.config.minimumTagLength || 3;
	config.maximumTagLength = meta.config.maximumTagLength || 15;
	config.hasImageUploadPlugin = plugins.hasListeners('filter:uploadImage');
	config.useOutgoingLinksPage = parseInt(meta.config.useOutgoingLinksPage, 10) === 1;
	config.allowGuestSearching = parseInt(meta.config.allowGuestSearching, 10) === 1;
	config.allowGuestUserSearching = parseInt(meta.config.allowGuestUserSearching, 10) === 1;
	config.allowGuestHandles = parseInt(meta.config.allowGuestHandles, 10) === 1;
	config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
	config.allowTopicsThumbnail = parseInt(meta.config.allowTopicsThumbnail, 10) === 1;
	config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
	config.disableChat = parseInt(meta.config.disableChat, 10) === 1;
	config.socketioTransports = nconf.get('socket.io:transports') || ['polling', 'websocket'];
	config.websocketAddress = nconf.get('socket.io:address') || '';
	config.maxReconnectionAttempts = meta.config.maxReconnectionAttempts || 5;
	config.reconnectionDelay = meta.config.reconnectionDelay || 1500;
	config.topicsPerPage = meta.config.topicsPerPage || 20;
	config.postsPerPage = meta.config.postsPerPage || 20;
	config.maximumFileSize = meta.config.maximumFileSize;
	config['theme:id'] = meta.config['theme:id'];
	config['theme:src'] = meta.config['theme:src'];
	config.defaultLang = meta.config.defaultLang || 'en_GB';
	config.userLang = req.query.lang || config.defaultLang;
	config.loggedIn = !!req.user;
	config['cache-buster'] = meta.config['cache-buster'] || '';
	config.requireEmailConfirmation = parseInt(meta.config.requireEmailConfirmation, 10) === 1;
	config.topicPostSort = meta.config.topicPostSort || 'oldest_to_newest';
	config.categoryTopicSort = meta.config.categoryTopicSort || 'newest_to_oldest';
	config.csrf_token = req.csrfToken();
	config.searchEnabled = plugins.hasListeners('filter:search.query');
	config.bootswatchSkin = 'default';

	async.waterfall([
		function (next) {
			if (!req.user) {
				return next(null, config);
			}
			user.getSettings(req.uid, function(err, settings) {
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
				config.delayImageLoading = settings.delayImageLoading !== undefined ? settings.delayImageLoading : true;
				config.bootswatchSkin = settings.bootswatchSkin || config.bootswatchSkin;
				next(null, config);
			});
		},
		function (config, next) {
			plugins.fireHook('filter:config.get', config, next);
		}
	], function(err, config) {
		if (err) {
			return next(err);
		}

		if (res.locals.isAPI) {
			res.json(config);
		} else {
			next(null, config);
		}
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
			isMobile: req.query.isMobile === 'true'
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
	apiController.getObjectByType(req.uid, req.params.type, req.params.id, function(err, results) {
		if (err) {
			return next(err);
		}

		res.json(results);
	});
};

apiController.getObjectByType = function(uid, type, id, callback) {
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

	if (!methods[type]) {
		return callback();
	}

	async.waterfall([
		function (next) {
			methods[type].canRead('read', id, uid, next);
		},
		function (canRead, next) {
			if (!canRead) {
				return next(new Error('[[error:no-privileges]]'));
			}
			methods[type].data(id, next);
		}
	], callback);
};

apiController.getUserByUID = function(req, res, next) {
	byType('uid', req, res, next);
};

apiController.getUserByUsername = function(req, res, next) {
	byType('username', req, res, next);
};

apiController.getUserByEmail = function(req, res, next) {
	byType('email', req, res, next);
};

function byType(type, req, res, next) {
	apiController.getUserDataByField(req.uid, type, req.params[type], function(err, data) {
		if (err || !data) {
			return next(err);
		}
		res.json(data);
	});
}

apiController.getUserDataByField = function(callerUid, field, fieldValue, callback) {
	async.waterfall([
		function (next) {
			if (field === 'uid') {
				next(null, fieldValue);
			} else if (field === 'username') {
				user.getUidByUsername(fieldValue, next);
			} else if (field === 'email') {
				user.getUidByEmail(fieldValue, next);
			} else {
				next();
			}
		},
		function (uid, next) {
			if (!uid) {
				return next();
			}
			apiController.getUserDataByUID(callerUid, uid, next);
		}
	], callback);
};

apiController.getUserDataByUID = function(callerUid, uid, callback) {
	if (!parseInt(callerUid, 10) && parseInt(meta.config.privateUserInfo, 10) === 1) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	if (!parseInt(uid, 10)) {
		return callback(new Error('[[error:no-user]]'));
	}

	async.parallel({
		userData: async.apply(user.getUserData, uid),
		settings: async.apply(user.getSettings, uid)
	}, function(err, results) {
		if (err || !results.userData) {
			return callback(err || new Error('[[error:no-user]]'));
		}

		results.userData.email = results.settings.showemail ? results.userData.email : undefined;
		results.userData.fullname = results.settings.showfullname ? results.userData.fullname : undefined;

		callback(null, results.userData);
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
