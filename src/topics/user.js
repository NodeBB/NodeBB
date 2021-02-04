'use strict';

const db = require('../database');

module.exports = function (Topics) {
	Topics.isOwner = async function (tid, uid) {
		uid = parseInt(uid, 10);
		if (uid <= 0) {
			return false;
		}
		const author = await Topics.getTopicField(tid, 'uid');
		return author === uid;
	};

	Topics.getUids = async function (tid) {
		return await db.getSortedSetRevRangeByScore(`tid:${tid}:posters`, 0, -1, '+inf', 1);
	};
};
