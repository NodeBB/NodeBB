'use strict';

const db = require('../database');

module.exports = function (Categories) {
	Categories.markAsRead = async function (cids, uid) {
		// TODO: remove in 4.0
		console.warn('[deprecated] Categories.markAsRead deprecated');
		if (!Array.isArray(cids) || !cids.length || parseInt(uid, 10) <= 0) {
			return;
		}
		let keys = cids.map(cid => `cid:${cid}:read_by_uid`);
		const hasRead = await db.isMemberOfSets(keys, uid);
		keys = keys.filter((key, index) => !hasRead[index]);
		await db.setsAdd(keys, uid);
	};

	Categories.markAsUnreadForAll = async function (cid) {
		// TODO: remove in 4.0
		console.warn('[deprecated] Categories.markAsUnreadForAll deprecated');
		if (!parseInt(cid, 10)) {
			return;
		}
		await db.delete(`cid:${cid}:read_by_uid`);
	};

	Categories.hasReadCategories = async function (cids, uid) {
		// TODO: remove in 4.0
		console.warn('[deprecated] Categories.hasReadCategories deprecated, see Categories.setUnread');
		if (parseInt(uid, 10) <= 0) {
			return cids.map(() => false);
		}

		const sets = cids.map(cid => `cid:${cid}:read_by_uid`);
		return await db.isMemberOfSets(sets, uid);
	};

	Categories.hasReadCategory = async function (cid, uid) {
		// TODO: remove in 4.0
		console.warn('[deprecated] Categories.hasReadCategory deprecated, see Categories.setUnread');
		if (parseInt(uid, 10) <= 0) {
			return false;
		}
		return await db.isSetMember(`cid:${cid}:read_by_uid`, uid);
	};
};
