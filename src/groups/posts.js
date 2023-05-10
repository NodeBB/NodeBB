'use strict';

const db = require('../database');
const privileges = require('../privileges');
const posts = require('../posts');

module.exports = function (Groups) {
	Groups.onNewPostMade = async function (postData) {
		if (!parseInt(postData.uid, 10) || postData.timestamp > Date.now()) {
			return;
		}

		let groupNames = await Groups.getUserGroupMembership('groups:visible:createtime', [postData.uid]);
		groupNames = groupNames[0];

		// Only process those groups that have the cid in its memberPostCids setting (or no setting at all)
		const groupData = await Groups.getGroupsFields(groupNames, ['memberPostCids']);
		groupNames = groupNames.filter((groupName, idx) => (
			!groupData[idx].memberPostCidsArray.length ||
			groupData[idx].memberPostCidsArray.includes(postData.cid)
		));

		const keys = groupNames.map(groupName => `group:${groupName}:member:pids`);
		await db.sortedSetsAdd(keys, postData.timestamp, postData.pid);
		await Promise.all(groupNames.map(truncateMemberPosts));
	};

	async function truncateMemberPosts(groupName) {
		let lastPid = await db.getSortedSetRevRangeByScore(`group:${groupName}:member:pids`, 10, 1, Date.now(), '-inf');
		lastPid = lastPid[0];
		if (!parseInt(lastPid, 10)) {
			return;
		}
		const score = await db.sortedSetScore(`group:${groupName}:member:pids`, lastPid);
		await db.sortedSetsRemoveRangeByScore([`group:${groupName}:member:pids`], '-inf', score);
	}

	Groups.getLatestMemberPosts = async function (groupName, max, uid) {
		const [allPids, groupData] = await Promise.all([
			db.getSortedSetRevRangeByScore(`group:${groupName}:member:pids`, 0, max, Date.now(), '-inf'),
			Groups.getGroupFields(groupName, ['memberPostCids']),
		]);
		const cids = groupData.memberPostCidsArray;
		const pids = await privileges.posts.filter('topics:read', allPids, uid);
		const postData = await posts.getPostSummaryByPids(pids, uid, { stripTags: false });
		return postData.filter(p => p && p.topic && (!cids.length || cids.includes(p.topic.cid)));
	};
};
