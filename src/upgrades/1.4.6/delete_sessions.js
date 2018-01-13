'use strict';

var async = require('async');

var db = require('../../database');
var batch = require('../../batch');

module.exports = {
	name: 'Delete accidentally long-lived sessions',
	timestamp: Date.UTC(2017, 3, 16),
	method: function (callback) {
		var configJSON;
		try {
			configJSON = require('../../../config.json') || { [process.env.database]: true };
		} catch (err) {
			configJSON = { [process.env.database]: true };
		}

		var isRedisSessionStore = configJSON.hasOwnProperty('redis');
		var progress = this.progress;

		async.waterfall([
			function (next) {
				if (isRedisSessionStore) {
					var rdb = require('../../database/redis');
					var client = rdb.connect();
					async.waterfall([
						function (next) {
							client.keys('sess:*', next);
						},
						function (sessionKeys, next) {
							progress.total = sessionKeys.length;

							batch.processArray(sessionKeys, function (keys, next) {
								var multi = client.multi();
								keys.forEach(function (key) {
									progress.incr();
									multi.del(key);
								});
								multi.exec(next);
							}, {
								batch: 1000,
							}, next);
						},
					], function (err) {
						next(err);
					});
				} else if (db.client && db.client.collection) {
					db.client.collection('sessions').deleteMany({}, {}, function (err) {
						next(err);
					});
				} else {
					next();
				}
			},
		], callback);
	},
};
