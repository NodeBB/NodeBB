'use strict';

const async = require('async');
const plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.merge = async function (tids, uid, options) {
		options = options || {};
		const oldestTid = findOldestTopic(tids);
		let mergeIntoTid = oldestTid;
		if (options.mainTid) {
			mergeIntoTid = options.mainTid;
		} else if (options.newTopicTitle) {
			mergeIntoTid = await createNewTopic(options.newTopicTitle, oldestTid);
		}

		const otherTids = tids.sort((a, b) => a - b)
			.filter(tid => tid && parseInt(tid, 10) !== parseInt(mergeIntoTid, 10));

		await async.eachSeries(otherTids, async function (tid) {
			const pids = await Topics.getPids(tid);
			await async.eachSeries(pids, function (pid, next) {
				Topics.movePostToTopic(uid, pid, mergeIntoTid, next);
			});

			await Topics.setTopicField(tid, 'mainPid', 0);
			await Topics.delete(tid, uid);
			await Topics.setTopicFields(tid, {
				mergeIntoTid: mergeIntoTid,
				mergerUid: uid,
				mergedTimestamp: Date.now(),
			});
		});

		plugins.hooks.fire('action:topic.merge', { uid: uid, tids: tids, mergeIntoTid: mergeIntoTid, otherTids: otherTids });
		return mergeIntoTid;
	};

	async function createNewTopic(title, oldestTid) {
		const topicData = await Topics.getTopicFields(oldestTid, ['uid', 'cid']);
		const tid = await Topics.create({
			uid: topicData.uid,
			cid: topicData.cid,
			title: title,
		});
		return tid;
	}

	function findOldestTopic(tids) {
		return Math.min.apply(null, tids);
	}
};
