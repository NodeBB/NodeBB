'use strict';

const db = require('../database');
const topics = require('.');
const user = require('../user');
const categories = require('../categories');
const posts = require('../posts');
const activitypub = require('../activitypub');
const utils = require('../utils');

const Crossposts = module.exports;

Crossposts.get = async function (tid) {
	const crosspostIds = await db.getSortedSetMembers(`tid:${tid}:crossposts`);
	let crossposts = await db.getObjects(crosspostIds.map(id => `crosspost:${id}`));
	const cids = crossposts.reduce((cids, crossposts) => {
		cids.add(crossposts.cid);
		return cids;
	}, new Set());
	let categoriesData = await categories.getCategoriesFields(
		Array.from(cids), ['cid', 'name', 'icon', 'bgColor', 'color', 'slug']
	);
	categoriesData = categoriesData.reduce((map, category) => {
		map.set(parseInt(category.cid, 10), category);
		return map;
	}, new Map());
	crossposts = crossposts.map((crosspost, idx) => {
		crosspost.id = crosspostIds[idx];
		crosspost.category = categoriesData.get(parseInt(crosspost.cid, 10));
		crosspost.uid = utils.isNumber(crosspost.uid) ? parseInt(crosspost.uid) : crosspost.uid;
		crosspost.cid = utils.isNumber(crosspost.cid) ? parseInt(crosspost.cid) : crosspost.cid;

		return crosspost;
	});

	return crossposts;
};

Crossposts.add = async function (tid, cid, uid) {
	/**
	 * NOTE: If uid is 0, the assumption is that it is a "system" crosspost, not a guest!
	 * (Normally guest uid is 0)
	 */

	// Target cid must exist
	if (!utils.isNumber(cid)) {
		await activitypub.actors.assert(cid);
	}
	const exists = await categories.exists(cid);
	if (!exists) {
		throw new Error('[[error:invalid-cid]]');
	}
	if (uid < 0) {
		throw new Error('[[error:invalid-uid]]');
	}

	const crossposts = await Crossposts.get(tid);
	const crosspostedCids = crossposts.map(crosspost => String(crosspost.cid));
	const now = Date.now();
	const crosspostId = utils.generateUUID();
	if (!crosspostedCids.includes(String(cid))) {
		const [topicData, pids] = await Promise.all([
			topics.getTopicFields(tid, ['uid', 'cid', 'timestamp']),
			topics.getPids(tid),
		]);
		let pidTimestamps = await posts.getPostsFields(pids, ['timestamp']);
		pidTimestamps = pidTimestamps.map(({ timestamp }) => timestamp);

		if (cid === topicData.cid) {
			throw new Error('[[error:invalid-cid]]');
		}
		const zsets = [
			`cid:${topicData.cid}:tids`,
			`cid:${topicData.cid}:tids:create`,
			`cid:${topicData.cid}:tids:lastposttime`,
			`cid:${topicData.cid}:uid:${topicData.uid}:tids`,
			`cid:${topicData.cid}:tids:votes`,
			`cid:${topicData.cid}:tids:posts`,
			`cid:${topicData.cid}:tids:views`,
		];
		const scores = await db.sortedSetsScore(zsets, tid);
		const bulkAdd = zsets.map((zset, idx) => {
			return [zset.replace(`cid:${topicData.cid}`, `cid:${cid}`), scores[idx], tid];
		});
		await Promise.all([
			db.sortedSetAddBulk(bulkAdd),
			db.sortedSetAdd(`cid:${cid}:pids`, pidTimestamps, pids),
			db.setObject(`crosspost:${crosspostId}`, { uid, tid, cid, timestamp: now }),
			db.sortedSetAdd(`tid:${tid}:crossposts`, now, crosspostId),
			uid > 0 ? db.sortedSetAdd(`uid:${uid}:crossposts`, now, crosspostId) : false,
		]);
		await categories.onTopicsMoved([cid]);
	} else {
		throw new Error('[[error:topic-already-crossposted]]');
	}

	return [...crossposts, { id: crosspostId, uid, tid, cid, timestamp: now }];
};

Crossposts.remove = async function (tid, cid, uid) {
	let crossposts = await Crossposts.get(tid);
	const isPrivileged = await user.isAdminOrGlobalMod(uid);
	const isMod = await user.isModerator(uid, cid);
	const crosspostId = crossposts.reduce((id, { id: _id, cid: _cid, uid: _uid }) => {
		if (String(cid) === String(_cid) && (isPrivileged || isMod || String(uid) === String(_uid))) {
			id = _id;
		}

		return id;
	}, null);
	if (!crosspostId) {
		throw new Error('[[error:invalid-data]]');
	}

	const [author, pids] = await Promise.all([
		topics.getTopicField(tid, 'uid'),
		topics.getPids(tid),
	]);
	let bulkRemove = [
		`cid:${cid}:tids`,
		`cid:${cid}:tids:create`,
		`cid:${cid}:tids:lastposttime`,
		`cid:${cid}:uid:${author}:tids`,
		`cid:${cid}:tids:votes`,
		`cid:${cid}:tids:posts`,
		`cid:${cid}:tids:views`,
	];
	bulkRemove = bulkRemove.map(zset => [zset, tid]);

	await Promise.all([
		db.sortedSetRemoveBulk(bulkRemove),
		db.delete(`crosspost:${crosspostId}`),
		db.sortedSetRemove(`tid:${tid}:crossposts`, crosspostId),
		db.sortedSetRemove(`cid:${cid}:pids`, pids),
		uid > 0 ? db.sortedSetRemove(`uid:${uid}:crossposts`, crosspostId) : false,
	]);
	await categories.onTopicsMoved([cid]);

	crossposts = await Crossposts.get(tid);
	return crossposts;
};

Crossposts.removeAll = async function (tid) {
	const crosspostIds = await db.getSortedSetMembers(`tid:${tid}:crossposts`);
	const crossposts = await db.getObjects(crosspostIds.map(id => `crosspost:${id}`));
	await Promise.all(crossposts.map(async ({ tid, cid, uid }) => {
		return Crossposts.remove(tid, cid, uid);
	}));

	return [];
};