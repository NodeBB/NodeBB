'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const categories = require('../categories');
const flags = require('../flags');
const plugins = require('../plugins');
const batch = require('../batch');
const activitypub = require('../activitypub');
const utils = require('../utils');

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
			activitypub.out.remove.context(uid, tid),
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

	Topics.purgePostsAndTopic = async function (tids, uid) {
		if (!Array.isArray(tids)) {
			tids = [tids];
		}
		let topicData = await Topics.getTopicsFields(tids, ['tid', 'mainPid']);
		topicData = topicData.filter(t => t && t.tid);
		const tidsToDelete = topicData.map(t => t.tid);

		await Promise.all(tidsToDelete.map(async (tid) => {
			await batch.processSortedSet(`tid:${tid}:posts`, async (pids) => {
				await posts.purge(pids, uid);
				await db.sortedSetRemove(`tid:${tid}:posts`, pids); // Guard against infinite loop if pid already does not exist in db
			}, { alwaysStartAt: 0, batch: 500 });
		}));

		await posts.purge(topicData.map(t => t.mainPid), uid);
		await Topics.purge(tidsToDelete, uid);
	};

	Topics.purge = async function (tids, uid) {
		if (!Array.isArray(tids)) {
			tids = [tids];
		}
		const deletedTopics = (await Topics.getTopicsData(tids)).filter(Boolean);
		if (!deletedTopics.length) {
			return;
		}
		const tidsToDelete = deletedTopics.map(t => t.tid);
		deletedTopics.forEach((t) => {
			t.tags = t.tags.map(tag => tag.value);
		});

		await deleteFromFollowersIgnorers(tidsToDelete);

		const remoteTids = [];
		const localTids = [];

		for (const tid of tidsToDelete) {
			if (utils.isNumber(tid)) {
				localTids.push(tid);
			} else {
				remoteTids.push(tid);
			}
		}

		await Promise.all([
			deleteKeys(tidsToDelete),
			db.sortedSetsRemove([
				'topics:recent',
				'topics:scheduled',
			], tidsToDelete),
			db.sortedSetsRemove([
				'topics:tid',
				'topics:views',
				'topics:posts',
				'topics:votes',
			], localTids),
			db.sortedSetsRemove([
				'topicsRemote:tid',
				'topicsRemote:views',
				'topicsRemote:posts',
				'topicsRemote:votes',
			], remoteTids),
			deleteTopicsFromCategoryAndUser(deletedTopics),
			deleteFromTags(deletedTopics),
			Topics.events.purge(tidsToDelete),
			Topics.crossposts.removeAll(tidsToDelete),

			reduceCounters(deletedTopics),
		]);

		// DEPRECATED hook
		deletedTopics.forEach((topic) => {
			plugins.hooks.fire('action:topic.purge', { topic, uid });
		});

		// new hook
		plugins.hooks.fire('action:topics.purge', { topics: deletedTopics, uid });

		await db.deleteAll(tids.map(tid => `topic:${tid}`));
	};

	async function deleteFromFollowersIgnorers(tids) {
		const [followers, ignorers] = await Promise.all([
			db.getSetsMembers(tids.map(tid => `tid:${tid}:followers`)),
			db.getSetsMembers(tids.map(tid => `tid:${tid}:ignorers`)),
		]);
		const bulkRemove = [];
		tids.forEach((tid, index) => {
			followers[index].forEach((uid) => {
				bulkRemove.push([`uid:${uid}:followed_tids`, tid]);
			});
			ignorers[index].forEach((uid) => {
				bulkRemove.push([`uid:${uid}:followed_tids`, tid]);
			});
		});
		await db.sortedSetRemoveBulk(bulkRemove);
	}

	async function deleteKeys(tids) {
		await db.deleteAll([
			...tids.map(tid => `tid:${tid}:followers`),
			...tids.map(tid => `tid:${tid}:ignorers`),
			...tids.map(tid => `tid:${tid}:posts`),
			...tids.map(tid => `tid:${tid}:posts:votes`),
			...tids.map(tid => `tid:${tid}:bookmarks`),
			...tids.map(tid => `tid:${tid}:posters`),
		]);
	}

	async function deleteTopicsFromCategoryAndUser(topicsData) {
		const bulkRemove = [];
		for (const topic of topicsData) {
			bulkRemove.push([`cid:${topic.cid}:tids`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:tids:pinned`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:tids:create`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:tids:posts`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:tids:lastposttime`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:tids:votes`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:tids:views`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:recent_tids`, topic.tid]);
			bulkRemove.push([`cid:${topic.cid}:uid:${topic.uid}:tids`, topic.tid]);
			bulkRemove.push([`uid:${topic.uid}:topics`, topic.tid]);
		}
		await db.sortedSetRemoveBulk(bulkRemove);
		const uniqCids = new Set();
		const uniqUids = new Set();
		topicsData.forEach((t) => {
			uniqCids.add(String(t.cid));
			uniqUids.add(String(t.uid));
		});

		await user.updateTopicCount(Array.from(uniqUids));
		await Promise.all(Array.from(uniqCids).map(cid => categories.updateRecentTidForCid(cid)));
	}

	async function deleteFromTags(topicsData) {
		const bulkRemove = [];
		const uniqCids = new Set();
		const uniqTags = new Set();
		for (const topic of topicsData) {
			for (const tag of topic.tags) {
				bulkRemove.push([`tag:${tag}:topics`, topic.tid]);
				bulkRemove.push([`cid:${topic.cid}:tag:${tag}:topics`, topic.tid]);
				uniqTags.add(tag);
			}
			uniqCids.add(String(topic.cid));
		}
		await db.sortedSetRemoveBulk(bulkRemove);

		await Topics.updateCategoryTagsCount(
			Array.from(uniqCids),
			Array.from(uniqTags)
		);
		await Topics.updateTagCount(uniqTags);
	}

	async function reduceCounters(topicsData) {
		const bulkIncr = [];
		let globalPostCountChange = 0;
		let globalTopicCountChange = 0;

		const topicsByCid = _.groupBy(topicsData, t => String(t.cid));
		for (const [cid, topics] of Object.entries(topicsByCid)) {
			const cidPostCountChange = Math.max(0, topics.reduce((acc, t) => acc + t.postcount, 0));
			const categoryKey = `${utils.isNumber(cid) ? 'category' : 'categoryRemote'}:${cid}`;

			bulkIncr.push([
				categoryKey, { post_count: -cidPostCountChange, topic_count: -topics.length },
			]);

			for (const topic of topics) {
				if (utils.isNumber(topic.tid)) {
					globalPostCountChange += topic.postcount;
					globalTopicCountChange += 1;
				}
			}
		}

		if (globalPostCountChange || globalTopicCountChange) {
			bulkIncr.push([
				'global', { postCount: -globalPostCountChange, topicCount: -globalTopicCountChange },
			]);
		}
		await db.incrObjectFieldByBulk(bulkIncr);
	}
};
