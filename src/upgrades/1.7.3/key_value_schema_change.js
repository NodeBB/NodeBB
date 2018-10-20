'use strict';

var async = require('async');

var db = require('../../database');

module.exports = {
	name: 'Change the schema of simple keys so they don\'t use value field (mongodb only)',
	timestamp: Date.UTC(2017, 11, 18),
	method: function (callback) {
		var configJSON;
		try {
			configJSON = require('../../../config.json') || { [process.env.database]: true, database: process.env.database };
		} catch (err) {
			configJSON = { [process.env.database]: true, database: process.env.database };
		}
		var isMongo = configJSON.hasOwnProperty('mongo') && configJSON.database === 'mongo';
		var progress = this.progress;
		if (!isMongo) {
			return callback();
		}
		var client = db.client;
		var cursor;
		async.waterfall([
			function (next) {
				client.collection('objects').countDocuments({
					_key: { $exists: true },
					value: { $exists: true },
					score: { $exists: false },
				}, next);
			},
			function (count, next) {
				progress.total = count;
				cursor = client.collection('objects').find({
					_key: { $exists: true },
					value: { $exists: true },
					score: { $exists: false },
				}).batchSize(1000);

				var done = false;
				async.whilst(
					function () {
						return !done;
					},
					function (next) {
						async.waterfall([
							function (next) {
								cursor.next(next);
							},
							function (item, next) {
								progress.incr();
								if (item === null) {
									done = true;
									return next();
								}
								delete item.expireAt;
								if (Object.keys(item).length === 3 && item.hasOwnProperty('_key') && item.hasOwnProperty('value')) {
									client.collection('objects').updateOne({ _key: item._key }, { $rename: { value: 'data' } }, next);
								} else {
									next();
								}
							},
						], function (err) {
							next(err);
						});
					},
					next
				);
			},
		], callback);
	},
};
