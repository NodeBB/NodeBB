
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

				settings.showemail = settings.showemail ? parseInt(settings.showemail, 10) !== 0 : false;
				settings.usePagination = settings.usePagination ? parseInt(settings.usePagination, 10) === 1 : parseInt(meta.config.usePagination, 10) === 1;
				settings.topicsPerPage = settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : parseInt(meta.config.topicsPerPage, 10) || 20;
				settings.postsPerPage = settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : parseInt(meta.config.postsPerPage, 10) || 10;
				settings.notificationSounds = settings.notificationSounds ? parseInt(settings.notificationSounds, 10) === 1 : true;
				callback(null, settings);
			});
		});
	};

	User.saveSettings = function(uid, data, callback) {

		if(!data.topicsPerPage || !data.postsPerPage || parseInt(data.topicsPerPage, 10) <= 0 || parseInt(data.postsPerPage, 10) <= 0) {
			return callback(new Error('[[error:invalid-pagination-value]]'));
		}

		plugins.fireHook('action:user.saveSettings', {uid: uid, settings: data});

		db.setObject('user:' + uid + ':settings', {
			showemail: data.showemail,
			usePagination: data.usePagination,
			topicsPerPage: data.topicsPerPage,
			postsPerPage: data.postsPerPage,
			notificationSounds: data.notificationSounds
		}, callback);
	};
};
