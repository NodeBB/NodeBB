'use strict';

const winston = require('winston');

const db = require('../database');
const posts = require('../posts');

const activitypub = module.parent.exports;
const Notes = module.exports;

Notes.resolveId = async (uid, id) => {
	({ id } = await activitypub.get(uid, id));
	return id;
};

// todo: when asserted, notes aren't added to a global sorted set
// also, db.exists call is probably expensive
Notes.assert = async (uid, input) => {
	// Ensures that each note has been saved to the database
	await Promise.all(input.map(async (item) => {
		const id = activitypub.helpers.isUri(item) ? item : item.pid;
		const key = `post:${id}`;
		const exists = await db.exists(key);
		winston.verbose(`[activitypub/notes.assert] Asserting note id ${id}`);

		if (!exists) {
			let postData;
			winston.verbose(`[activitypub/notes.assert] Not found, saving note to database`);
			if (activitypub.helpers.isUri(item)) {
				const object = await activitypub.get(uid, item);
				postData = await activitypub.mocks.post(object);
			} else {
				postData = item;
			}

			await db.setObject(key, postData);
		}
	}));
};

Notes.getParentChain = async (uid, input) => {
	// Traverse upwards via `inReplyTo` until you find the root-level Note
	const id = activitypub.helpers.isUri(input) ? input : input.id;

	const chain = new Set();
	const traverse = async (uid, id) => {
		const exists = await db.exists(`post:${id}`);
		if (exists) {
			const postData = await posts.getPostData(id);
			chain.add(postData);
			if (postData.toPid) {
				await traverse(uid, postData.toPid);
			}
		} else {
			let object = await activitypub.get(uid, id);
			object = await activitypub.mocks.post(object);
			if (object) {
				chain.add(object);
				if (object.toPid) {
					await traverse(uid, object.toPid);
				}
			}
		}
	};

	await traverse(uid, id);
	return chain;
};

Notes.assertParentChain = async (chain) => {
	const data = [];
	chain.reduce((child, parent) => {
		data.push([`pid:${parent.pid}:replies`, child.timestamp, child.pid]);
		return parent;
	});

	await db.sortedSetAddBulk(data);
};

Notes.assertTopic = async (uid, id) => {
	/**
	 * Given the id of any post, traverses up to cache the entire threaded context
	 *
	 * Unfortunately, due to limitations and fragmentation of the existing ActivityPub landscape,
	 * retrieving the entire reply tree is not possible at this time.
	 */

	const chain = Array.from(await Notes.getParentChain(uid, id));
	const { pid: tid, uid: authorId } = chain[chain.length - 1];

	const members = await db.isSortedSetMembers(`tidRemote:${tid}:posts`, chain.map(p => p.pid));
	if (members.every(Boolean)) {
		// All cached, return early.
		winston.info('[notes/assertTopic] No new notes to process.');
		return tid;
	}

	const unprocessed = chain.filter((p, idx) => !members[idx]);
	winston.info(`[notes/assertTopic] ${unprocessed.length} new notes found.`);

	const [ids, timestamps] = [
		unprocessed.map(n => n.pid),
		unprocessed.map(n => n.timestamp),
	];

	await Promise.all([
		db.setObject(`topicRemote:${tid}`, {
			tid,
			uid: authorId,
			cid: -1,
			mainPid: tid,
			title: 'TBD',
			slug: `remote?resource=${encodeURIComponent(tid)}`,
		}),
		db.sortedSetAdd(`tidRemote:${tid}:posts`, timestamps, ids),
		Notes.assert(uid, unprocessed),
	]);
	await Promise.all([ // must be done after .assert()
		Notes.assertParentChain(chain),
		Notes.updateTopicCounts(tid),
	]);

	return tid;
};

Notes.updateTopicCounts = async function (tid) {
	const pids = await db.getSortedSetMembers(`tidRemote:${tid}:posts`);
	let uids = await db.getObjectsFields(pids.map(p => `post:${p}`), ['uid']);
	uids = uids.reduce((set, { uid }) => {
		set.add(uid);
		return set;
	}, new Set());

	db.setObject(`topicRemote:${tid}`, {
		postercount: uids.size,
		postcount: pids.length,
	});
};

Notes.getTopicPosts = async (tid, uid, start, stop) => {
	const pids = await db.getSortedSetRange(`tidRemote:${tid}:posts`, start, stop);
	return await posts.getPostsByPids(pids, uid);
};
