'use strict';

import nconf from 'nconf';
import db from '../../database';
//@ts-ignore
import cJSON from '../../../config.json';
import * as batch from '../../batch';
import connection from '../../database/redis/connection';


export const obj = {
	name: 'Delete accidentally long-lived sessions',
	timestamp: Date.UTC(2017, 3, 16),
	method: async function () {
		let configJSON;
		try {
			configJSON = cJSON || { [(process as any).env.database]: true };
		} catch (err: any) {
			configJSON = { [(process as any).env.database]: true };
		}

		const isRedisSessionStore = configJSON.hasOwnProperty('redis');
		const { progress } = this;

		if (isRedisSessionStore) {
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
