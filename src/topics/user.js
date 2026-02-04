'use strict';

const db = require('../database');
const utils = require('../utils');

module.exports = function (Topics) {
	Topics.isOwner = async function (tid, uid) {
		if (utils.isNumber(uid) && parseInt(uid, 10) <= 0) {
			return false;
		}
		const author = await Topics.getTopicField(tid, 'uid');
		return String(author) === String(uid);
	};

	Topics.getUids = async function (tid) {
		return await db.getSortedSetRevRangeByScore(`tid:${tid}:posters`, 0, -1, '+inf', 1);
	};
};
