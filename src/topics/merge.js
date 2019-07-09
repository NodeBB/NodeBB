'use strict';

const async = require('async');
const plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.merge = async function (tids, uid) {
		const mergeIntoTid = findOldestTopic(tids);

		const otherTids = tids.filter(tid => tid && parseInt(tid, 10) !== parseInt(mergeIntoTid, 10));

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

		plugins.fireHook('action:topic.merge', { uid: uid, tids: tids, mergeIntoTid: mergeIntoTid, otherTids: otherTids });
	};

	function findOldestTopic(tids) {
		return Math.min.apply(null, tids);
	}
};
