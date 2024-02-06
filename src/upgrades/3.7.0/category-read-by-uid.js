/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Remove cid:<cid>:read_by_uid sets',
	timestamp: Date.UTC(2024, 0, 29),
	method: async function () {
		const { progress } = this;
		const nextCid = await db.getObjectField('global', 'nextCid');
		const allCids = [];
		for (let i = 1; i <= nextCid; i++) {
			allCids.push(i);
		}
		await batch.processArray(allCids, async (cids) => {
			await db.deleteAll(cids.map(cid => `cid:${cid}:read_by_uid`));
			progress.incr(cids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
