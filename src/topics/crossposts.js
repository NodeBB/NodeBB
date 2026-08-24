'use strict';

const winston = require('winston');
const _ = require('lodash');
const db = require('../database');
const topics = require('.');
const meta = require('../meta');
const user = require('../user');
const categories = require('../categories');
const posts = require('../posts');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const utils = require('../utils');

const Crossposts = module.exports;

Crossposts.get = async function (tids, uid) {
	const isArray = Array.isArray(tids);
	if (!isArray) {
		tids = [tids];
	}

	const crosspostIds = await db.getSortedSetsMembers(tids.map(tid => `tid:${tid}:crossposts`));
	const allCrosspostIds = crosspostIds.flat();
	const allCrossposts = await db.getObjects(allCrosspostIds.map(id => `crosspost:${id}`));

	const allCids = _.uniq(allCrossposts.map(c => c.cid));
	const allowedCids = uid ? await privileges.categories.filterCids('find', allCids, uid) : allCids;

	const categoriesData = await categories.getCategoriesFields(
		allowedCids, ['cid', 'name', 'icon', 'bgColor', 'color', 'slug']
	);

	const categoriesMap = categoriesData.reduce((map, category) => {
		map.set(parseInt(category.cid, 10), category);
		return map;
	}, new Map());

	const allowedCidSet = new Set(allowedCids);
	const crosspostEntries = allCrosspostIds.map((id, index) => ({ id, crosspost: allCrossposts[index] }))
		.filter(({ crosspost }) => !uid || allowedCidSet.has(crosspost.cid));

	const crosspostMap = crosspostEntries.reduce((map, { id, crosspost }) => {
		if (id && crosspost) {
			map.set(id, crosspost);
			crosspost.id = id;
			crosspost.category = categoriesMap.get(parseInt(crosspost.cid, 10));
			crosspost.uid = utils.isNumber(crosspost.uid) ? parseInt(crosspost.uid, 10) : crosspost.uid;
			crosspost.cid = utils.isNumber(crosspost.cid) ? parseInt(crosspost.cid, 10) : crosspost.cid;
		}
		return map;
	}, new Map());

	const crossposts = crosspostIds.map(ids => ids.map(id => crosspostMap.get(id)).filter(Boolean));
	return isArray ? crossposts : crossposts[0];
};

Crossposts.syncCrosspostedTopicCids = async function (crossposts, topicData) {
	// `:tids:posts`, `:tids:votes` and `:tids:views` are only written for the topic's own
	// category, so crossposted categories keep the values they were seeded with. Reconcile
	// them when the topic is read, which is cheap and only runs for crossposted topics.
	// Pinned topics are absent from these zsets by design, so they are skipped.
	if (!crossposts.length || topicData.pinned) {
		return;
	}

	const cids = crossposts.map(crosspost => crosspost.cid);
	const count = cids.length;
	const scores = await db.sortedSetsScore([
		...cids.map(cid => `cid:${cid}:tids:posts`),
		...cids.map(cid => `cid:${cid}:tids:votes`),
		...cids.map(cid => `cid:${cid}:tids:views`),
	], topicData.tid);

	const postcounts = scores.slice(0, count);
	const votes = scores.slice(count, count * 2);
	const viewcounts = scores.slice(count * 2);

	const bulkAdd = [];
	cids.forEach((cid, index) => {
		if (topicData.postcount !== postcounts[index]) {
			bulkAdd.push([`cid:${cid}:tids:posts`, topicData.postcount, topicData.tid]);
		}
		if (topicData.votes !== votes[index]) {
			bulkAdd.push([`cid:${cid}:tids:votes`, topicData.votes, topicData.tid]);
		}
		if (topicData.viewcount !== viewcounts[index]) {
			bulkAdd.push([`cid:${cid}:tids:views`, topicData.viewcount, topicData.tid]);
		}
	});

	if (bulkAdd.length) {
		await db.sortedSetAddBulk(bulkAdd);
	}
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
	const [exists, destAllowed, sourceAllowed] = await Promise.all([
		categories.exists(cid),
		uid === 0 || privileges.categories.can('topics:crosspost', cid, uid),
		uid === 0 || privileges.topics.can('topics:read', tid, uid),
	]);
	if (!exists) {
		throw new Error('[[error:invalid-cid]]');
	}
	if (!destAllowed || !sourceAllowed) {
		throw new Error('[[error:not-allowed]]');
	}
	if (uid < 0) {
		throw new Error('[[error:invalid-uid]]');
	}

	const crossposts = await Crossposts.get(tid);
	const crosspostedCids = crossposts.map(crosspost => String(crosspost.cid));
	const now = Date.now();
	const crosspostId = utils.generateUUID();
	if (!crosspostedCids.includes(String(cid))) {
		const [topicData, pids, tags] = await Promise.all([
			topics.getTopicFields(tid, [
				'uid', 'cid', 'timestamp', 'lastposttime', 'pinned',
				'postcount', 'viewcount', 'upvotes', 'downvotes',
			]),
			topics.getPids(tid),
			topics.getTopicTags(tid),
		]);
		let pidTimestamps = await posts.getPostsFields(pids, ['timestamp']);
		pidTimestamps = pidTimestamps.map(({ timestamp }) => timestamp);

		if (cid === topicData.cid) {
			throw new Error('[[error:invalid-cid]]');
		}

		// Scores are derived from topic data, not copied from the source category's
		// sorted sets — a pinned topic is absent from those sets, and copying a null
		// score throws (`[[error:invalid-score, null]]`)
		const votes = (parseInt(topicData.upvotes, 10) || 0) - (parseInt(topicData.downvotes, 10) || 0);
		const bulkAdd = [
			[`cid:${cid}:tids:lastposttime`, topicData.lastposttime, tid],
			[`cid:${cid}:uid:${topicData.uid}:tids`, topicData.timestamp, tid],
			...tags.map(tag => [`cid:${cid}:tag:${tag}:topics`, topicData.timestamp, tid]),
		];
		if (topicData.pinned) {
			bulkAdd.push([`cid:${cid}:tids:pinned`, now, tid]);
		} else {
			bulkAdd.push([`cid:${cid}:tids`, topicData.lastposttime, tid]);
			bulkAdd.push([`cid:${cid}:tids:create`, topicData.timestamp, tid]);
			bulkAdd.push([`cid:${cid}:tids:posts`, topicData.postcount || 0, tid]);
			bulkAdd.push([`cid:${cid}:tids:votes`, votes, tid]);
			bulkAdd.push([`cid:${cid}:tids:views`, topicData.viewcount || 0, tid]);
		}

		await Promise.all([
			db.sortedSetAddBulk(bulkAdd),
			db.sortedSetAdd(`cid:${cid}:pids`, pidTimestamps, pids),
			db.setObject(`crosspost:${crosspostId}`, { uid, tid, cid, timestamp: now }),
			db.sortedSetAdd(`tid:${tid}:crossposts`, now, crosspostId),
			uid > 0 ? db.sortedSetAdd(`uid:${uid}:crossposts`, now, crosspostId) : false,
			topics.events.log(tid, { uid, type: 'crosspost', toCid: cid }),
		]);
		await Promise.all([
			topics.updateCategoryTagsCount([cid], tags),
			categories.onTopicsMoved([cid]), // must be done after
		]);
	} else {
		throw new Error('[[error:topic-already-crossposted]]');
	}

	return [...crossposts, { id: crosspostId, uid, tid, cid, timestamp: now }];
};

Crossposts.queue = async function (tid, cid, uid) {
	if (!meta.config.postQueue) {
		return;
	}
	const title = await topics.getTopicField(tid, 'title');
	await posts.addToQueue({
		uid: uid || 0,
		tid,
		title,
		crosspostCid: cid,
	});
};

Crossposts.remove = async function (tid, cid, uid) {
	let crossposts = await Crossposts.get(tid);
	const [isPrivileged, isMod] = await Promise.all([
		user.isAdminOrGlobalMod(uid),
		user.isModerator(uid, cid),
	]);
	const crosspostId = crossposts.reduce((id, { id: _id, cid: _cid, uid: _uid }) => {
		if (String(cid) === String(_cid) && (isPrivileged || isMod || String(uid) === String(_uid))) {
			id = _id;
		}

		return id;
	}, null);
	if (!crosspostId) {
		throw new Error('[[error:invalid-data]]');
	}

	const [author, pids, tags] = await Promise.all([
		topics.getTopicField(tid, 'uid'),
		topics.getPids(tid),
		topics.getTopicTags(tid),
	]);
	let bulkRemove = [
		`cid:${cid}:tids`,
		`cid:${cid}:tids:create`,
		`cid:${cid}:tids:lastposttime`,
		`cid:${cid}:tids:pinned`,
		`cid:${cid}:uid:${author}:tids`,
		`cid:${cid}:tids:votes`,
		`cid:${cid}:tids:posts`,
		`cid:${cid}:tids:views`,
		...tags.map(tag => `cid:${cid}:tag:${tag}:topics`),
	];
	bulkRemove = bulkRemove.map(zset => [zset, tid]);

	await Promise.all([
		db.sortedSetRemoveBulk(bulkRemove),
		db.delete(`crosspost:${crosspostId}`),
		db.sortedSetRemove(`tid:${tid}:crossposts`, crosspostId),
		db.sortedSetRemove(`cid:${cid}:pids`, pids),
		uid > 0 ? db.sortedSetRemove(`uid:${uid}:crossposts`, crosspostId) : false,
	]);
	await Promise.all([
		topics.updateCategoryTagsCount([cid], tags),
		categories.onTopicsMoved([cid]),
	]);

	topics.events.find(tid, { uid, toCid: cid, type: 'crosspost' }).then((eventIds) => {
		topics.events.purge(tid, eventIds);
	}).catch(err => winston.error(err));

	crossposts = await Crossposts.get(tid);
	return crossposts;
};

Crossposts.removeAll = async function (tids) {
	if (!Array.isArray(tids)) {
		tids = [tids];
	}
	const allCrosspostIds = (await db.getSortedSetsMembers(
		tids.map(tid => `tid:${tid}:crossposts`)
	)).flat();
	const crossposts = (await db.getObjects(
		allCrosspostIds.map(id => `crosspost:${id}`)
	)).filter(Boolean);

	await Promise.all(
		crossposts.map(({ tid, cid, uid }) => Crossposts.remove(tid, cid, uid))
	);
};