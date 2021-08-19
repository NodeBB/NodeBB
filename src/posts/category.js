
'use strict';


const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');

module.exports = function (Posts) {
	Posts.getCidByPid = async function (pid) {
		const tid = await Posts.getPostField(pid, 'tid');
		return await topics.getTopicField(tid, 'cid');
	};

	Posts.getCidsByPids = async function (pids) {
		const postData = await Posts.getPostsFields(pids, ['tid']);
		const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
		const topicData = await topics.getTopicsFields(tids, ['cid']);
		const tidToTopic = _.zipObject(tids, topicData);
		const cids = postData.map(post => tidToTopic[post.tid] && tidToTopic[post.tid].cid);
		return cids;
	};

	Posts.filterPidsByCid = async function (pids, cid) {
		if (!cid) {
			return pids;
		}

		if (!Array.isArray(cid) || cid.length === 1) {
			return await filterPidsBySingleCid(pids, cid);
		}
		const pidsArr = await Promise.all(cid.map(c => Posts.filterPidsByCid(pids, c)));
		return _.union(...pidsArr);
	};

	async function filterPidsBySingleCid(pids, cid) {
		const isMembers = await db.isSortedSetMembers(`cid:${parseInt(cid, 10)}:pids`, pids);
		return pids.filter((pid, index) => pid && isMembers[index]);
	}
};
