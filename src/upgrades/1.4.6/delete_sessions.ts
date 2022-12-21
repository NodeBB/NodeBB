'use strict';

const nconf = require('nconf');
const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Delete accidentally long-lived sessions',
	timestamp: Date.UTC(2017, 3, 16),
	method: async function () {
		let configJSON;
		try {
			configJSON = require('../../../config.json') || { [process.env.database]: true };
		} catch (err) {
			configJSON = { [process.env.database]: true };
		}

		const isRedisSessionStore = configJSON.hasOwnProperty('redis');
		const { progress } = this;

		if (isRedisSessionStore) {
			const connection = require('../../database/redis/connection');
			const client = await connection.connect(nconf.get('redis'));
			const sessionKeys = await client.keys('sess:*');
			progress.total = sessionKeys.length;

			await batch.processArray(sessionKeys, async (keys) => {
				const multi = client.multi();
				keys.forEach((key) => {
					progress.incr();
					multi.del(key);
				});
				await multi.exec();
			}, {
				batch: 1000,
			});
		} else if (db.client && db.client.collection) {
			await db.client.collection('sessions').deleteMany({}, {});
		}
	},
};
