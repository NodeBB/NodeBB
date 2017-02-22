/* jslint node: true */
'use strict';

var db = require('../database');

var async = require('async');
var winston = require('winston');

module.exports = {
	name: 'Update global and user language keys',
	timestamp: Date.UTC(2016, 10, 22),
	method: function (callback) {
		var user = require('../user');
		var meta = require('../meta');
		var batch = require('../batch');
		var newLanguage;
		var i = 0;
		var j = 0;
		async.parallel([
			function (next) {
				meta.configs.get('defaultLang', function (err, defaultLang) {
					if (err) {
						return next(err);
					}

					if (!defaultLang) {
						return setImmediate(next);
					}

					newLanguage = defaultLang.replace('_', '-').replace('@', '-x-');
					if (newLanguage !== defaultLang) {
						meta.configs.set('defaultLang', newLanguage, next);
					} else {
						setImmediate(next);
					}
				});
			},
			function (next) {
				batch.processSortedSet('users:joindate', function (ids, next) {
					async.each(ids, function (uid, next) {
						async.waterfall([
							async.apply(db.getObjectField, 'user:' + uid + ':settings', 'userLang'),
							function (language, next) {
								++i;
								if (!language) {
									return setImmediate(next);
								}

								newLanguage = language.replace('_', '-').replace('@', '-x-');
								if (newLanguage !== language) {
									++j;
									user.setSetting(uid, 'userLang', newLanguage, next);
								} else {
									setImmediate(next);
								}
							}
						], next);
					}, next);
				}, next);
			}
		], callback);
	}
};