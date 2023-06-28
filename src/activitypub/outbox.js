'use strict';

const db = require('../database');

const outbox = module.exports;

outbox.isFollowing = async (uid, actorId) => {
	if (parseInt(uid, 10) <= 0 || actorId.indexOf('@') === -1) {
		return false;
	}
	return await db.isSortedSetMember(`followingRemote:${uid}`, actorId);
};

