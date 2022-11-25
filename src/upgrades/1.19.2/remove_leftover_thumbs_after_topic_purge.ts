'use strict';

import path from 'path';const fs = require('fs').promises;
import nconf from 'nconf';

import * as database from '../../database';
const db = database as any;
const batch = require('../../batch');
const file = require('../../file');

export default  {
	name: 'Clean up leftover topic thumb sorted sets and files for since-purged topics',
	timestamp: Date.UTC(2022, 1, 7),
	method: async function () {
		const { progress } = this as any;
		const nextTid = await db.getObjectField('global', 'nextTid');
		const tids : any[] = [];
		for (let x = 1; x < nextTid; x++) {
			tids.push(x);
		}

		const purgedTids = (await db.isSortedSetMembers('topics:tid', tids))
			.map((exists, idx) => (exists ? false : tids[idx]))
			.filter(Boolean);

		const affectedTids = (await db.exists(purgedTids.map(tid => `topic:${tid}:thumbs`)))
			.map((exists, idx) => (exists ? purgedTids[idx] : false))
			.filter(Boolean);

		progress.total = affectedTids.length;

		await batch.processArray(affectedTids, async (tids) => {
			await Promise.all(tids.map(async (tid) => {
				const relativePaths = await db.getSortedSetMembers(`topic:${tid}:thumbs`);
				const absolutePaths = relativePaths.map(relativePath => path.join(nconf.get('upload_path'), relativePath));

				await Promise.all(absolutePaths.map(async (absolutePath) => {
					const exists = await file.exists(absolutePath);
					if (exists) {
						await fs.unlink(absolutePath);
					}
				}));
				await db.delete(`topic:${tid}:thumbs`);
				progress.incr();
			}));
		}, {
			progress,
			batch: 100,
		});
	},
};
