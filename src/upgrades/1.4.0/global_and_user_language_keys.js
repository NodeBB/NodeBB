'use strict';

const async = require('async');
const db = require('../../database');


module.exports = {
	name: 'Update global and user language keys',
	timestamp: Date.UTC(2016, 10, 22),
	method: function (callback) {
		const user = require('../../user');
		const meta = require('../../meta');
		const batch = require('../../batch');
		let newLanguage;
		async.parallel([
			function (next) {
				meta.configs.get('defaultLang', (err, defaultLang) => {
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
				batch.processSortedSet('users:joindate', (ids, next) => {
					async.each(ids, (uid, next) => {
						async.waterfall([
							async.apply(db.getObjectField, `user:${uid}:settings`, 'userLang'),
							function (language, next) {
								if (!language) {
									return setImmediate(next);
								}

								newLanguage = language.replace('_', '-').replace('@', '-x-');
								if (newLanguage !== language) {
									user.setSetting(uid, 'userLang', newLanguage, next);
								} else {
									setImmediate(next);
								}
							},
						], next);
					}, next);
				}, next);
			},
		], callback);
	},
};
