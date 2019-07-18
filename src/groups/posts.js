'use strict';

const db = require('../database');
const privileges = require('../privileges');
const posts = require('../posts');

module.exports = function (Groups) {
	Groups.onNewPostMade = async function (postData) {
		if (!parseInt(postData.uid, 10)) {
			return;
		}

		let groupNames = await Groups.getUserGroupMembership('groups:visible:createtime', [postData.uid]);
		groupNames = groupNames[0];

		const keys = groupNames.map(groupName => 'group:' + groupName + ':member:pids');
		await db.sortedSetsAdd(keys, postData.timestamp, postData.pid);
		await Promise.all(groupNames.map(name => truncateMemberPosts(name)));
	};

	async function truncateMemberPosts(groupName) {
		let lastPid = await db.getSortedSetRevRange('group:' + groupName + ':member:pids', 10, 10);
		lastPid = lastPid[0];
		if (!parseInt(lastPid, 10)) {
			return;
		}
		const score = await db.sortedSetScore('group:' + groupName + ':member:pids', lastPid);
		await db.sortedSetsRemoveRangeByScore(['group:' + groupName + ':member:pids'], '-inf', score);
	}

	Groups.getLatestMemberPosts = async function (groupName, max, uid) {
		let pids = await db.getSortedSetRevRange('group:' + groupName + ':member:pids', 0, max - 1);
		pids = await privileges.posts.filter('topics:read', pids, uid);
		return await posts.getPostSummaryByPids(pids, uid, { stripTags: false });
	};
};
