'use strict';


const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Dismiss flags from deleted topics',
	timestamp: Date.UTC(2016, 3, 29),
	method: async function () {
		const posts = require('../../posts');
		const topics = require('../../topics');

		const pids = await db.getSortedSetRange('posts:flagged', 0, -1);
		const postData = await posts.getPostsFields(pids, ['tid']);
		const tids = postData.map(t => t.tid);
		const topicData = await topics.getTopicsFields(tids, ['deleted']);
		const toDismiss = topicData.map((t, idx) => (parseInt(t.deleted, 10) === 1 ? pids[idx] : null)).filter(Boolean);

		winston.verbose(`[2016/04/29] ${toDismiss.length} dismissable flags found`);
		await Promise.all(toDismiss.map(dismissFlag));
	},
};

// copied from core since this function was removed
// https://github.com/NodeBB/NodeBB/blob/v1.x.x/src/posts/flags.js
async function dismissFlag(pid) {
	const postData = await db.getObjectFields(`post:${pid}`, ['pid', 'uid', 'flags']);
	if (!postData.pid) {
		return;
	}
	if (parseInt(postData.uid, 10) && parseInt(postData.flags, 10) > 0) {
		await Promise.all([
			db.sortedSetIncrBy('users:flags', -postData.flags, postData.uid),
			db.incrObjectFieldBy(`user:${postData.uid}`, 'flags', -postData.flags),
		]);
	}
	const uids = await db.getSortedSetRange(`pid:${pid}:flag:uids`, 0, -1);
	const nids = uids.map(uid => `post_flag:${pid}:uid:${uid}`);

	await Promise.all([
		db.deleteAll(nids.map(nid => `notifications:${nid}`)),
		db.sortedSetRemove('notifications', nids),
		db.delete(`pid:${pid}:flag:uids`),
		db.sortedSetsRemove([
			'posts:flagged',
			'posts:flags:count',
			`uid:${postData.uid}:flag:pids`,
		], pid),
		db.deleteObjectField(`post:${pid}`, 'flags'),
		db.delete(`pid:${pid}:flag:uid:reason`),
		db.deleteObjectFields(`post:${pid}`, ['flag:state', 'flag:assignee', 'flag:notes', 'flag:history']),
	]);

	await db.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0);
}
