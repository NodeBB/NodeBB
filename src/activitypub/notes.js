'use strict';

const winston = require('winston');

const db = require('../database');
const posts = require('../posts');

const activitypub = module.parent.exports;
const Notes = module.exports;

// todo: when asserted, notes aren't added to a global sorted set
// also, db.exists call is probably expensive
Notes.assert = async (uid, input) => {
	// Ensures that each note has been saved to the database
	await Promise.all(input.map(async (item) => {
		const id = activitypub.helpers.isUri(item) ? item : item.id;
		const key = `post:${id}`;
		const exists = await db.exists(key);
		winston.verbose(`[activitypub/notes.assert] Asserting note id ${id}`);

		let postData;
		if (!exists) {
			winston.verbose(`[activitypub/notes.assert] Not found, saving note to database`);
			const object = activitypub.helpers.isUri(item) ? await activitypub.get(uid, item) : item;
			postData = await activitypub.mocks.post(object);
			if (postData) {
				await db.setObject(key, postData);
			}
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
			const { toPid, timestamp } = await posts.getPostFields(id, ['toPid', 'timestamp']);
			chain.add({ id, timestamp });
			if (toPid) {
				await traverse(uid, toPid);
			}
		} else {
			let object = await activitypub.get(uid, id);
			object = await activitypub.mocks.post(object);
			if (object) {
				chain.add({ id, timestamp: object.timestamp });
				if (object.hasOwnProperty('toPid') && object.toPid) {
					await traverse(uid, object.toPid);
				}
			}
		}
	};

	await traverse(uid, id);
	return chain;
};

Notes.assertTopic = async (uid, id) => {
	// Given the id of any post, traverses up (and soon, down) to cache the entire threaded context
	const chain = Array.from(await Notes.getParentChain(uid, id));
	const tid = chain[chain.length - 1].id;

	const sorted = chain.sort((a, b) => a.timestamp - b.timestamp);
	const [ids, timestamps] = [
		sorted.map(n => n.id),
		sorted.map(n => n.timestamp),
	];

	await db.sortedSetAdd(`topicRemote:${tid}`, timestamps, ids);
	await Notes.assert(uid, chain);

	return tid;
};

Notes.getTopicPosts = async (tid, uid, start, stop) => {
	const pids = await db.getSortedSetRange(`topicRemote:${tid}`, start, stop);
	return await posts.getPostsByPids(pids, uid);
};
