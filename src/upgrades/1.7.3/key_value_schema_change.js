'use strict';

const async = require('async');

const db = require('../../database');

module.exports = {
	name: 'Change the schema of simple keys so they don\'t use value field (mongodb only)',
	timestamp: Date.UTC(2017, 11, 18),
	method: function (callback) {
		let configJSON;
		try {
			configJSON = require('../../../config.json') || { [process.env.database]: true, database: process.env.database };
		} catch (err) {
			configJSON = { [process.env.database]: true, database: process.env.database };
		}
		const isMongo = configJSON.hasOwnProperty('mongo') && configJSON.database === 'mongo';
		const { progress } = this;
		if (!isMongo) {
			return callback();
		}
		const { client } = db;
		let cursor;
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

				let done = false;
				async.whilst(
					(next) => {
						next(null, !done);
					},
					(next) => {
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
						], (err) => {
							next(err);
						});
					},
					next
				);
			},
		], callback);
	},
};
