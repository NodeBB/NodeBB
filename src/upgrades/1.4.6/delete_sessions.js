/* jslint node: true */

'use strict';

var db = require('../../database');
var async = require('async');

module.exports = {
	name: 'Delete accidentally long-lived sessions',
	timestamp: Date.UTC(2017, 3, 16),
	method: function (callback) {
		var configJSON = require.main.require('./config.json');
		var isRedisSessionStore = configJSON.hasOwnProperty('redis');
		var progress = this.progress;

		async.waterfall([
			function (next) {
				if (isRedisSessionStore) {
					var rdb = require.main.require('./src/database/redis');
					var client = rdb.connect();
					async.waterfall([
						function (next) {
							client.keys('sess:*', next);
						},
						function (sessionKeys, next) {
							progress.total = sessionKeys.length;

							async.eachSeries(sessionKeys, function (key, next) {
								progress.incr();
								client.del(key, next);
							}, next);
						},
					], function (err) {
						next(err);
					});
				} else {
					db.client.collection('sessions').deleteMany({}, {}, function (err) {
						next(err);
					});
				}
			},
		], callback);
	},
};
