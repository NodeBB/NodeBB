/* jslint node: true */

'use strict';

var db = require('../database');

var async = require('async');

module.exports = {
	name: 'Update global and user sound settings',
	timestamp: Date.UTC(2017, 1, 25),
	method: function (callback) {
		var user = require('../user');
		var meta = require('../meta');
		var batch = require('../batch');

		var map = {
			'notification.mp3': 'Default | Deedle-dum',
			'waterdrop-high.mp3': 'Default | Water drop (high)',
			'waterdrop-low.mp3': 'Default | Water drop (low)',
		};

		async.parallel([
			function (cb) {
				var keys = ['chat-incoming', 'chat-outgoing', 'notification'];

				db.getObject('settings:sounds', function (err, settings) {
					if (err) {
						return cb(err);
					}

					keys.forEach(function (key) {
						if (settings[key] && settings[key].indexOf(' | ') === -1) {
							settings[key] = map[settings[key]] || '';
						}
					});

					meta.configs.setMultiple(settings, cb);
				});
			},
			function (cb) {
				var keys = ['notificationSound', 'incomingChatSound', 'outgoingChatSound'];

				batch.processSortedSet('users:joindate', function (ids, next) {
					async.each(ids, function (uid, next) {
						user.getSettings(uid, function (err, settings) {
							if (err) {
								return next(err);
							}

							keys.forEach(function (key) {
								if (settings[key] && settings[key].indexOf(' | ') === -1) {
									settings[key] = map[settings[key]] || '';
								}
							});

							user.saveSettings(uid, settings, next);
						});
					}, next);
				}, cb);
			},
		], callback);
	},
};
