
'use strict';

var	meta = require('./../meta'),
	db = require('./../database'),
	plugins = require('./../plugins');

module.exports = function(User) {

	User.getSettings = function(uid, callback) {
		db.getObject('user:' + uid + ':settings', function(err, settings) {
			if(err) {
				return callback(err);
			}

			if(!settings) {
				settings = {};
			}

			plugins.fireHook('filter:user.getSettings', {uid: uid, settings: settings}, function(err, data) {
				if(err) {
					return callback(err);
				}

				settings = data.settings;

				settings.showemail = parseInt(settings.showemail, 10) === 1;
				settings.openOutgoingLinksInNewTab = parseInt(settings.openOutgoingLinksInNewTab, 10) === 1;
				settings.dailyDigestFreq = settings.dailyDigestFreq || 'off';
				settings.usePagination = (settings.usePagination === null || settings.usePagination === undefined) ? parseInt(meta.config.usePagination, 10) === 1 : parseInt(settings.usePagination, 10) === 1;
				settings.topicsPerPage = Math.min(settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : parseInt(meta.config.topicsPerPage, 10) || 20, 20);
				settings.postsPerPage = Math.min(settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : parseInt(meta.config.postsPerPage, 10) || 10, 20);
				settings.notificationSounds = parseInt(settings.notificationSounds, 10) === 1;
				settings.language = settings.language || meta.config.defaultLang || 'en_GB';
				settings.topicPostSort = settings.topicPostSort || meta.config.topicPostSort || 'oldest_to_newest';
				settings.followTopicsOnCreate = (settings.followTopicsOnCreate === null || settings.followTopicsOnCreate === undefined) ? true : parseInt(settings.followTopicsOnCreate, 10) === 1;
				settings.followTopicsOnReply = parseInt(settings.followTopicsOnReply, 10) === 1;
				settings.sendChatNotifications = parseInt(settings.sendChatNotifications, 10) === 1;

				callback(null, settings);
			});
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

			// Associate uid
			settings = settings.map(function(setting, idx) {
				setting = setting || {};
				setting.uid = uids[idx];
				return setting;
			});

			callback(null, settings);
		});
	};

	User.saveSettings = function(uid, data, callback) {
		if(!data.topicsPerPage || !data.postsPerPage || parseInt(data.topicsPerPage, 10) <= 0 || parseInt(data.postsPerPage, 10) <= 0) {
			return callback(new Error('[[error:invalid-pagination-value]]'));
		}

		data.language = data.language || meta.config.defaultLang;

		plugins.fireHook('action:user.saveSettings', {uid: uid, settings: data});
		db.setObject('user:' + uid + ':settings', {
			showemail: data.showemail,
			openOutgoingLinksInNewTab: data.openOutgoingLinksInNewTab,
			dailyDigestFreq: data.dailyDigestFreq || 'off',
			usePagination: data.usePagination,
			topicsPerPage: Math.min(data.topicsPerPage, 20),
			postsPerPage: Math.min(data.postsPerPage, 20),
			notificationSounds: data.notificationSounds,
			language: data.language || meta.config.defaultLang,
			followTopicsOnCreate: data.followTopicsOnCreate,
			followTopicsOnReply: data.followTopicsOnReply,
			sendChatNotifications: data.sendChatNotifications
		}, callback);
	};

	User.setSetting = function(uid, key, value, callback) {
		db.setObjectField('user:' + uid + ':settings', key, value, callback);
	};
};
