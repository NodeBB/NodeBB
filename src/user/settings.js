
'use strict';

var	async = require('async'),
	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins');

module.exports = function(User) {

	User.getSettings = function(uid, callback) {
		if (!parseInt(uid, 10)) {
			return onSettingsLoaded(0, {}, callback);
		}

		db.getObject('user:' + uid + ':settings', function(err, settings) {
			if (err) {
				return callback(err);
			}

			onSettingsLoaded(uid, settings ? settings : {}, callback);
		});
	};

	User.getMultipleUserSettings = function(uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var keys = uids.map(function(uid) {
			return 'user:' + uid + ':settings';
		});

		db.getObjects(keys, function(err, settings) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<settings.length; ++i) {
				settings[i] = settings[i] || {};
				settings[i].uid = uids[i];
			}

			async.map(settings, function(setting, next) {
				onSettingsLoaded(setting.uid, setting, next);
			}, callback);
		});
	};

	function onSettingsLoaded(uid, settings, callback) {
		plugins.fireHook('filter:user.getSettings', {uid: uid, settings: settings}, function(err, data) {
			if (err) {
				return callback(err);
			}

			settings = data.settings;

			settings.showemail = parseInt(settings.showemail, 10) === 1;
			settings.showfullname = parseInt(settings.showfullname, 10) === 1;
			settings.openOutgoingLinksInNewTab = parseInt(settings.openOutgoingLinksInNewTab, 10) === 1;
			settings.dailyDigestFreq = settings.dailyDigestFreq || 'off';
			settings.usePagination = (settings.usePagination === null || settings.usePagination === undefined) ? parseInt(meta.config.usePagination, 10) === 1 : parseInt(settings.usePagination, 10) === 1;
			settings.topicsPerPage = Math.min(settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : parseInt(meta.config.topicsPerPage, 10) || 20, 20);
			settings.postsPerPage = Math.min(settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : parseInt(meta.config.postsPerPage, 10) || 10, 20);
			settings.notificationSounds = parseInt(settings.notificationSounds, 10) === 1;
			settings.language = settings.language || meta.config.defaultLang || 'en_GB';
			settings.topicPostSort = settings.topicPostSort || meta.config.topicPostSort || 'oldest_to_newest';
			settings.categoryTopicSort = settings.categoryTopicSort || meta.config.categoryTopicSort || 'newest_to_oldest';
			settings.followTopicsOnCreate = (settings.followTopicsOnCreate === null || settings.followTopicsOnCreate === undefined) ? true : parseInt(settings.followTopicsOnCreate, 10) === 1;
			settings.followTopicsOnReply = parseInt(settings.followTopicsOnReply, 10) === 1;
			settings.sendChatNotifications = parseInt(settings.sendChatNotifications, 10) === 1;
			settings.sendPostNotifications = parseInt(settings.sendPostNotifications, 10) === 1;
			settings.restrictChat = parseInt(settings.restrictChat, 10) === 1;
			settings.topicSearchEnabled = parseInt(settings.topicSearchEnabled, 10) === 1;

			callback(null, settings);
		});
	}

	User.saveSettings = function(uid, data, callback) {
		if(!data.topicsPerPage || !data.postsPerPage || parseInt(data.topicsPerPage, 10) <= 0 || parseInt(data.postsPerPage, 10) <= 0) {
			return callback(new Error('[[error:invalid-pagination-value]]'));
		}

		data.language = data.language || meta.config.defaultLang;

		plugins.fireHook('action:user.saveSettings', {uid: uid, settings: data});

		async.waterfall([
			function(next) {
				db.setObject('user:' + uid + ':settings', {
					showemail: data.showemail,
					showfullname: data.showfullname,
					openOutgoingLinksInNewTab: data.openOutgoingLinksInNewTab,
					dailyDigestFreq: data.dailyDigestFreq || 'off',
					usePagination: data.usePagination,
					topicsPerPage: Math.min(data.topicsPerPage, 20),
					postsPerPage: Math.min(data.postsPerPage, 20),
					notificationSounds: data.notificationSounds,
					language: data.language || meta.config.defaultLang,
					followTopicsOnCreate: data.followTopicsOnCreate,
					followTopicsOnReply: data.followTopicsOnReply,
					sendChatNotifications: data.sendChatNotifications,
					sendPostNotifications: data.sendPostNotifications,
					restrictChat: data.restrictChat,
					topicSearchEnabled: data.topicSearchEnabled
				}, next);
			},
			function(next) {
				updateDigestSetting(uid, data.dailyDigestFreq, next);
			},
			function(next) {
				User.getSettings(uid, next);
			}
		], callback);
	};

	function updateDigestSetting(uid, dailyDigestFreq, callback) {
		async.waterfall([
			function(next) {
				db.sortedSetsRemove(['digest:day:uids', 'digest:week:uids', 'digest:month:uids'], uid, next);
			},
			function(next) {
				if (['day', 'week', 'month'].indexOf(dailyDigestFreq) !== -1) {
					db.sortedSetAdd('digest:' + dailyDigestFreq + ':uids', Date.now(), uid, next);
				} else {
					next();
				}
			}
		], callback);
	}

	User.setSetting = function(uid, key, value, callback) {
		db.setObjectField('user:' + uid + ':settings', key, value, callback);
	};
};
