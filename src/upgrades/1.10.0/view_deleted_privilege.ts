/* eslint-disable no-await-in-loop */

'use strict';

const groups = require('../../groups');
import db from '../../database';

export default  {
	name: 'Give deleted post viewing privilege to moderators on all categories',
	timestamp: Date.UTC(2018, 5, 8),
	method: async function () {
		const { progress } = this as any;
		const cids = await db.getSortedSetRange('categories:cid', 0, -1);
		for (const cid of cids) {
			const uids = await db.getSortedSetRange(`group:cid:${cid}:privileges:moderate:members`, 0, -1);
			for (const uid of uids) {
				await groups.join(`cid:${cid}:privileges:posts:view_deleted`, uid);
			}
			progress.incr();
		}
	},
};
