'use strict';

const plugins = require('../plugins');
const posts = require('../posts');

module.exports = function (Topics) {
	Topics.merge = async function (tids, uid, options) {
		options = options || {};

		const topicsData = await Topics.getTopicsFields(tids, ['scheduled']);
		if (topicsData.some(t => t.scheduled)) {
			throw new Error('[[error:cant-merge-scheduled]]');
		}

		const oldestTid = findOldestTopic(tids);
		let mergeIntoTid = oldestTid;
		if (options.mainTid) {
			mergeIntoTid = options.mainTid;
		} else if (options.newTopicTitle) {
			mergeIntoTid = await createNewTopic(options.newTopicTitle, oldestTid);
		}

		const otherTids = tids.sort((a, b) => a - b)
			.filter(tid => tid && parseInt(tid, 10) !== parseInt(mergeIntoTid, 10));

		for (const tid of otherTids) {
			/* eslint-disable no-await-in-loop */
			const pids = await Topics.getPids(tid);
			for (const pid of pids) {
				await Topics.movePostToTopic(uid, pid, mergeIntoTid);
			}

			await Topics.setTopicField(tid, 'mainPid', 0);
			await Topics.delete(tid, uid);
			await Topics.setTopicFields(tid, {
				mergeIntoTid: mergeIntoTid,
				mergerUid: uid,
				mergedTimestamp: Date.now(),
			});
		}

		await Promise.all([
			posts.updateQueuedPostsTopic(mergeIntoTid, otherTids),
			updateViewCount(mergeIntoTid, tids),
		]);

		plugins.hooks.fire('action:topic.merge', {
			uid: uid,
			tids: tids,
			mergeIntoTid: mergeIntoTid,
			otherTids: otherTids,
		});
		return mergeIntoTid;
	};

	async function createNewTopic(title, oldestTid) {
		const topicData = await Topics.getTopicFields(oldestTid, ['uid', 'cid']);
		const params = {
			uid: topicData.uid,
			cid: topicData.cid,
			title: title,
		};
		const result = await plugins.hooks.fire('filter:topic.mergeCreateNewTopic', {
			oldestTid: oldestTid,
			params: params,
		});
		const tid = await Topics.create(result.params);
		return tid;
	}

	async function updateViewCount(mergeIntoTid, tids) {
		const topicData = await Topics.getTopicsFields(tids, ['viewcount']);
		const totalViewCount = topicData.reduce(
			(count, topic) => count + parseInt(topic.viewcount, 10), 0
		);
		await Topics.setTopicField(mergeIntoTid, 'viewcount', totalViewCount);
	}

	function findOldestTopic(tids) {
		return Math.min.apply(null, tids);
	}
};
