'use strict';

const db = require('../database');

module.exports = function (User) {
	User.getIgnoredTids = async function (uid, start, stop) {
		return await db.getSortedSetRevRange(`uid:${uid}:ignored_tids`, start, stop);
	};

	User.addTopicIdToUser = async function (uid, tid, timestamp) {
		await Promise.all([
			db.sortedSetAdd(`uid:${uid}:topics`, timestamp, tid),
			User.incrementUserFieldBy(uid, 'topiccount', 1),
		]);
	};
};
