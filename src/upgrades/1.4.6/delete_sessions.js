'use strict';

var async = require('async');

const nconf = require('nconf');
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
					var connection = require('../../database/redis/connection');
					var client;
					async.waterfall([
						function (next) {
							connection.connect(nconf.get('redis'), next);
						},
						function (_client, next) {
							client = _client;
							client.keys('sess:*', next);
						},
						function (sessionKeys, next) {
							progress.total = sessionKeys.length;

							batch.processArray(sessionKeys, (keys, next) => {
								var multi = client.multi();
								keys.forEach((key) => {
									progress.incr();
									multi.del(key);
								});
								multi.exec(next);
							}, {
								batch: 1000,
							}, next);
						},
					], (err) => {
						next(err);
					});
				} else if (db.client && db.client.collection) {
					db.client.collection('sessions').deleteMany({}, {}, (err) => {
						next(err);
					});
				} else {
					next();
				}
			},
		], callback);
	},
};
