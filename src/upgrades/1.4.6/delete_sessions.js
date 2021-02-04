'use strict';

const async = require('async');

const nconf = require('nconf');
const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Delete accidentally long-lived sessions',
	timestamp: Date.UTC(2017, 3, 16),
	method: function (callback) {
		let configJSON;
		try {
			configJSON = require('../../../config.json') || { [process.env.database]: true };
		} catch (err) {
			configJSON = { [process.env.database]: true };
		}

		const isRedisSessionStore = configJSON.hasOwnProperty('redis');
		const progress = this.progress;

		async.waterfall([
			function (next) {
				if (isRedisSessionStore) {
					const connection = require('../../database/redis/connection');
					let client;
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
								const multi = client.multi();
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
