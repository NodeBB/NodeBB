/* eslint-disable no-await-in-loop */
/* globals require, console, process */

'use strict';

const nconf = require('nconf');

nconf.file({
	file: 'config.json',
});

nconf.defaults({
	base_dir: __dirname,
	views_dir: './build/public/templates',
	upload_path: 'public/uploads',
});

const db = require('./src/database');

db.init(async (err) => {
	if (err) {
		console.log(`NodeBB could not connect to your database. Error: ${err.message}`);
		process.exit();
	}

	await search();
	console.log('done');
	process.exit();
});

async function search() {
	const batch = require('./src/batch');
	const topics = require('./src/topics');
	await batch.processSortedSet('topics:tid', async (tids) => {
		await Promise.all(tids.map(async (tid) => {
			const topicData = await db.getObjectFields(`topic:${tid}`, ['cid', 'tid', 'uid', 'oldCid', 'timestamp']);
			if (topicData.cid && topicData.oldCid) {
				const isMember = await db.isSortedSetMember(`cid:${topicData.oldCid}:uid:${topicData.uid}:tids`, topicData.tid);
				if (isMember) {
					await db.sortedSetRemove(`cid:${topicData.oldCid}:uid:${topicData.uid}:tids`, tid);
					await db.sortedSetAdd(`cid:${topicData.cid}:uid:${topicData.uid}:tids`, topicData.timestamp, tid);
				}
			}
		}));
	}, {
		batch: 500,
	});
}