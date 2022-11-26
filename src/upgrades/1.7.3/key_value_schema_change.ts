/* eslint-disable no-await-in-loop */

'use strict';

import { primaryDB as db } from '../../database';

export default  {
	name: 'Change the schema of simple keys so they don\'t use value field (mongodb only)',
	timestamp: Date.UTC(2017, 11, 18),
	method: async function () {
		let configJSON;
		try {
			configJSON = require('../../../config.json') || { [(process as any).env.database]: true, database: (process as any).env.database };
		} catch (err: any) {
			configJSON = { [(process as any).env.database]: true, database: (process as any).env.database };
		}
		const isMongo = configJSON.hasOwnProperty('mongo') && configJSON.database === 'mongo';
		const { progress } = this as any;
		if (!isMongo) {
			return;
		}
		const { client } = db;
		const query = {
			_key: { $exists: true },
			value: { $exists: true },
			score: { $exists: false },
		} as any;
		progress.total = await client.collection('objects').countDocuments(query);
		const cursor = await client.collection('objects').find(query).batchSize(1000);

		let done = false;
		while (!done) {
			const item = await cursor.next();
			progress.incr();
			if (item === null) {
				done = true;
			} else {
				delete item.expireAt;
				if (Object.keys(item).length === 3 && item.hasOwnProperty('_key') && item.hasOwnProperty('value')) {
					await client.collection('objects').updateOne({ _key: item._key }, { $rename: { value: 'data' } });
				}
			}
		}
	},
};
