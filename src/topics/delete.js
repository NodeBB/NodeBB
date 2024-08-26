'use strict';

const db = require('../database');

const user = require('../user');
const posts = require('../posts');
const categories = require('../categories');
const flags = require('../flags');
const plugins = require('../plugins');
const batch = require('../batch');


module.exports = function (Topics) {
	Topics.delete = async function (tid, uid) {
		const [cid, pids] = await Promise.all([
			Topics.getTopicField(tid, 'cid'),
			Topics.getPids(tid),
		]);
		await Promise.all([
			db.sortedSetRemove(`cid:${cid}:pids`, pids),
			resolveTopicPostFlags(pids, uid),
			Topics.setTopicFields(tid, {
				deleted: 1,
				deleterUid: uid,
				deletedTimestamp: Date.now(),
			}),
		]);

		await categories.updateRecentTidForCid(cid);
	};

	async function resolveTopicPostFlags(pids, uid) {
		await batch.processArray(pids, async (pids) => {
			const postData = await posts.getPostsFields(pids, ['pid', 'flagId']);
			const flaggedPosts = postData.filter(p => p && parseInt(p.flagId, 10));
			await Promise.all(flaggedPosts.map(p => flags.update(p.flagId, uid, { state: 'resolved' })));
		}, {
			batch: 500,
		});
	}

	async function addTopicPidsToCid(tid, cid) {
		const pids = await Topics.getPids(tid);
		let postData = await posts.getPostsFields(pids, ['pid', 'timestamp', 'deleted']);
		postData = postData.filter(post => post && !post.deleted);
		const pidsToAdd = postData.map(post => post.pid);
		const scores = postData.map(post => post.timestamp);
		await db.sortedSetAdd(`cid:${cid}:pids`, scores, pidsToAdd);
	}

	Topics.restore = async function (tid) {
		const cid = await Topics.getTopicField(tid, 'cid');
		await Promise.all([
			Topics.deleteTopicFields(tid, [
				'deleterUid', 'deletedTimestamp',
			]),
			addTopicPidsToCid(tid, cid),
		]);
		await Topics.setTopicField(tid, 'deleted', 0);
		await categories.updateRecentTidForCid(cid);
	};

	Topics.purgePostsAndTopic = async function (tid, uid) {
		const mainPid = await Topics.getTopicField(tid, 'mainPid');
		await batch.processSortedSet(`tid:${tid}:posts`, async (pids) => {
			await posts.purge(pids, uid);
		}, { alwaysStartAt: 0, batch: 500 });
		await posts.purge(mainPid, uid);
		await Topics.purge(tid, uid);
	};

	Topics.purge = async function (tid, uid) {
		const [deletedTopic, tags] = await Promise.all([
			Topics.getTopicData(tid),
			Topics.getTopicTags(tid),
		]);
		if (!deletedTopic) {
			return;
		}
		deletedTopic.tags = tags;
		await deleteFromFollowersIgnorers(tid);

		await Promise.all([
			db.deleteAll([
				`tid:${tid}:followers`,
				`tid:${tid}:ignorers`,
				`tid:${tid}:posts`,
				`tid:${tid}:posts:votes`,
				`tid:${tid}:bookmarks`,
				`tid:${tid}:posters`,
			]),
			db.sortedSetsRemove([
				'topics:tid',
				'topics:recent',
				'topics:posts',
				'topics:views',
				'topics:votes',
				'topics:scheduled',
			], tid),
			deleteTopicFromCategoryAndUser(tid),
			Topics.deleteTopicTags(tid),
			Topics.events.purge(tid),
			Topics.thumbs.deleteAll(tid),
			reduceCounters(tid),
		]);
		plugins.hooks.fire('action:topic.purge', { topic: deletedTopic, uid: uid });
		await db.delete(`topic:${tid}`);
	};

	async function deleteFromFollowersIgnorers(tid) {
		const [followers, ignorers] = await Promise.all([
			db.getSetMembers(`tid:${tid}:followers`),
			db.getSetMembers(`tid:${tid}:ignorers`),
		]);
		const followerKeys = followers.map(uid => `uid:${uid}:followed_tids`);
		const ignorerKeys = ignorers.map(uid => `uid:${uid}ignored_tids`);
		await db.sortedSetsRemove(followerKeys.concat(ignorerKeys), tid);
	}

	async function deleteTopicFromCategoryAndUser(tid) {
		const topicData = await Topics.getTopicFields(tid, ['cid', 'uid']);
		await Promise.all([
			db.sortedSetsRemove([
				`cid:${topicData.cid}:tids`,
				`cid:${topicData.cid}:tids:pinned`,
				`cid:${topicData.cid}:tids:create`,
				`cid:${topicData.cid}:tids:posts`,
				`cid:${topicData.cid}:tids:lastposttime`,
				`cid:${topicData.cid}:tids:votes`,
				`cid:${topicData.cid}:tids:views`,
				`cid:${topicData.cid}:recent_tids`,
				`cid:${topicData.cid}:uid:${topicData.uid}:tids`,
				`uid:${topicData.uid}:topics`,
			], tid),
			user.decrementUserFieldBy(topicData.uid, 'topiccount', 1),
		]);
		await categories.updateRecentTidForCid(topicData.cid);
	}

	async function reduceCounters(tid) {
		const incr = -1;
		await db.incrObjectFieldBy('global', 'topicCount', incr);
		const topicData = await Topics.getTopicFields(tid, ['cid', 'postcount']);
		const postCountChange = incr * topicData.postcount;
		await Promise.all([
			db.incrObjectFieldBy('global', 'postCount', postCountChange),
			db.incrObjectFieldBy(`category:${topicData.cid}`, 'post_count', postCountChange),
			db.incrObjectFieldBy(`category:${topicData.cid}`, 'topic_count', incr),
		]);
	}
};
