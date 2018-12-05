'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Group title from settings to user profile',
	timestamp: Date.UTC(2016, 3, 14),
	method: function (callback) {
		var user = require('../../user');
		var batch = require('../../batch');
		var count = 0;
		batch.processSortedSet('users:joindate', function (uids, next) {
			winston.verbose('upgraded ' + count + ' users');
			user.getMultipleUserSettings(uids, function (err, settings) {
				if (err) {
					return next(err);
				}
				count += uids.length;
				settings = settings.filter(function (setting) {
					return setting && setting.groupTitle;
				});

				async.each(settings, function (setting, next) {
					db.setObjectField('user:' + setting.uid, 'groupTitle', setting.groupTitle, next);
				}, next);
			});
		}, {}, callback);
	},
};
