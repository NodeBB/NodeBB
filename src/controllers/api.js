'use strict';

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
var translator = require('../translator');

var apiController = module.exports;

apiController.loadConfig = function (req, callback) {
	var config = {};
	config.relative_path = nconf.get('relative_path');
	config.upload_url = nconf.get('upload_url');
	config.siteTitle = validator.escape(String(meta.config.title || meta.config.browserTitle || 'NodeBB'));
	config.browserTitle = validator.escape(String(meta.config.browserTitle || meta.config.title || 'NodeBB'));
	config.titleLayout = (meta.config.titleLayout || '{pageTitle} | {browserTitle}').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
	config.showSiteTitle = parseInt(meta.config.showSiteTitle, 10) === 1;
	config.minimumTitleLength = meta.config.minimumTitleLength;
	config.maximumTitleLength = meta.config.maximumTitleLength;
	config.minimumPostLength = meta.config.minimumPostLength;
	config.maximumPostLength = meta.config.maximumPostLength;
	config.minimumTagsPerTopic = parseInt(meta.config.minimumTagsPerTopic || 0, 10);
	config.maximumTagsPerTopic = parseInt(meta.config.maximumTagsPerTopic || 5, 10);
	config.minimumTagLength = meta.config.minimumTagLength || 3;
	config.maximumTagLength = meta.config.maximumTagLength || 15;
	config.useOutgoingLinksPage = parseInt(meta.config.useOutgoingLinksPage, 10) === 1;
	config.allowGuestHandles = parseInt(meta.config.allowGuestHandles, 10) === 1;
	config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
	config.allowTopicsThumbnail = parseInt(meta.config.allowTopicsThumbnail, 10) === 1;
	config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
	config.disableChat = parseInt(meta.config.disableChat, 10) === 1;
	config.disableChatMessageEditing = parseInt(meta.config.disableChatMessageEditing, 10) === 1;
	config.maximumChatMessageLength = parseInt(meta.config.maximumChatMessageLength, 10) || 1000;
	config.socketioTransports = nconf.get('socket.io:transports') || ['polling', 'websocket'];
	config.websocketAddress = nconf.get('socket.io:address') || '';
	config.maxReconnectionAttempts = meta.config.maxReconnectionAttempts || 5;
	config.reconnectionDelay = meta.config.reconnectionDelay || 1500;
	config.topicsPerPage = meta.config.topicsPerPage || 20;
	config.postsPerPage = meta.config.postsPerPage || 20;
	config.maximumFileSize = meta.config.maximumFileSize;
	config['theme:id'] = meta.config['theme:id'];
	config['theme:src'] = meta.config['theme:src'];
	config.defaultLang = meta.config.defaultLang || 'en-GB';
	config.userLang = req.query.lang ? validator.escape(String(req.query.lang)) : config.defaultLang;
	config.loggedIn = !!req.user;
	config.uid = req.uid;
	config['cache-buster'] = meta.config['cache-buster'] || '';
	config.requireEmailConfirmation = parseInt(meta.config.requireEmailConfirmation, 10) === 1;
	config.topicPostSort = meta.config.topicPostSort || 'oldest_to_newest';
	config.categoryTopicSort = meta.config.categoryTopicSort || 'newest_to_oldest';
	config.csrf_token = req.csrfToken && req.csrfToken();
	config.searchEnabled = plugins.hasListeners('filter:search.query');
	config.bootswatchSkin = meta.config.bootswatchSkin || 'noskin';
	config.defaultBootswatchSkin = meta.config.bootswatchSkin || 'noskin';
	config.enablePostHistory = parseInt(meta.config.enablePostHistory || 1, 10) === 1;
	config.notificationAlertTimeout = parseInt(meta.config.notificationAlertTimeout, 10) || 5000;

	if (config.useOutgoingLinksPage) {
		config.outgoingLinksWhitelist = meta.config['outgoingLinks:whitelist'];
	}

	var timeagoCutoff = meta.config.timeagoCutoff === undefined ? 30 : meta.config.timeagoCutoff;
	config.timeagoCutoff = timeagoCutoff !== '' ? Math.max(0, parseInt(timeagoCutoff, 10)) : timeagoCutoff;

	config.cookies = {
		enabled: parseInt(meta.config.cookieConsentEnabled, 10) === 1,
		message: translator.escape(validator.escape(meta.config.cookieConsentMessage || '[[global:cookies.message]]')).replace(/\\/g, '\\\\'),
		dismiss: translator.escape(validator.escape(meta.config.cookieConsentDismiss || '[[global:cookies.accept]]')).replace(/\\/g, '\\\\'),
		link: translator.escape(validator.escape(meta.config.cookieConsentLink || '[[global:cookies.learn_more]]')).replace(/\\/g, '\\\\'),
	};

	async.waterfall([
		function (next) {
			if (!req.loggedIn) {
				return next(null, config);
			}
			user.getSettings(req.uid, next);
		},
		function (settings, next) {
			config.usePagination = settings.usePagination;
			config.topicsPerPage = settings.topicsPerPage;
			config.postsPerPage = settings.postsPerPage;
			config.userLang = (req.query.lang ? validator.escape(String(req.query.lang)) : null) || settings.userLang || config.defaultLang;
			config.acpLang = (req.query.lang ? validator.escape(String(req.query.lang)) : null) || settings.acpLang;
			config.openOutgoingLinksInNewTab = settings.openOutgoingLinksInNewTab;
			config.topicPostSort = settings.topicPostSort || config.topicPostSort;
			config.categoryTopicSort = settings.categoryTopicSort || config.categoryTopicSort;
			config.topicSearchEnabled = settings.topicSearchEnabled || false;
			config.delayImageLoading = settings.delayImageLoading !== undefined ? settings.delayImageLoading : true;
			config.bootswatchSkin = (parseInt(meta.config.disableCustomUserSkins, 10) !== 1 && settings.bootswatchSkin && settings.bootswatchSkin !== 'default') ? settings.bootswatchSkin : config.bootswatchSkin;
			plugins.fireHook('filter:config.get', config, next);
		},
	], callback);
};

apiController.getConfig = function (req, res, next) {
	async.waterfall([
		function (next) {
			apiController.loadConfig(req, next);
		},
		function (config, next) {
			if (res.locals.isAPI) {
				res.json(config);
			} else {
				next(null, config);
			}
		},
	], next);
};

apiController.getPostData = function (pid, uid, callback) {
	async.parallel({
		privileges: function (next) {
			privileges.posts.get([pid], uid, next);
		},
		post: function (next) {
			posts.getPostData(pid, next);
		},
	}, function (err, results) {
		if (err || !results.post) {
			return callback(err);
		}

		var post = results.post;
		var privileges = results.privileges[0];

		if (!privileges.read || !privileges['topics:read']) {
			return callback();
		}

		post.ip = privileges.isAdminOrMod ? post.ip : undefined;
		var selfPost = uid && uid === parseInt(post.uid, 10);
		if (post.deleted && !(privileges.isAdminOrMod || selfPost)) {
			post.content = '[[topic:post_is_deleted]]';
		}
		callback(null, post);
	});
};

apiController.getTopicData = function (tid, uid, callback) {
	async.parallel({
		privileges: function (next) {
			privileges.topics.get(tid, uid, next);
		},
		topic: function (next) {
			topics.getTopicData(tid, next);
		},
	}, function (err, results) {
		if (err || !results.topic) {
			return callback(err);
		}

		if (!results.privileges.read || !results.privileges['topics:read'] || (parseInt(results.topic.deleted, 10) && !results.privileges.view_deleted)) {
			return callback();
		}
		callback(null, results.topic);
	});
};

apiController.getCategoryData = function (cid, uid, callback) {
	async.parallel({
		privileges: function (next) {
			privileges.categories.get(cid, uid, next);
		},
		category: function (next) {
			categories.getCategoryData(cid, next);
		},
	}, function (err, results) {
		if (err || !results.category) {
			return callback(err);
		}

		if (!results.privileges.read) {
			return callback();
		}
		callback(null, results.category);
	});
};


apiController.getObject = function (req, res, next) {
	var methods = {
		post: apiController.getPostData,
		topic: apiController.getTopicData,
		category: apiController.getCategoryData,
	};
	var method = methods[req.params.type];
	if (!method) {
		return next();
	}
	method(req.params.id, req.uid, function (err, result) {
		if (err || !result) {
			return next(err);
		}

		res.json(result);
	});
};

apiController.getModerators = function (req, res, next) {
	categories.getModerators(req.params.cid, function (err, moderators) {
		if (err) {
			return next(err);
		}
		res.json({ moderators: moderators });
	});
};
