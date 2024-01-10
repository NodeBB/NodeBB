'use strict';

const winston = require('winston');

const db = require('../database');

const activitypub = module.parent.exports;
const Notes = module.exports;

Notes.get = async (uid, id) => {
	try {
		const object = await activitypub.get(uid, id);
		return await Notes.mockPost(object);
	} catch (e) {
		return null;
	}
};

// todo: move to mocks.js
Notes.mockPost = async (objects) => {
	const postCache = require('../posts/cache');

	let single = false;
	if (!Array.isArray(objects)) {
		single = true;
		objects = [objects];
	}

	const posts = (await Promise.all(objects.map(async (object) => {
		if (object.type !== 'Note') {
			return null;
		}

		const {
			id: pid,
			published,
			updated,
			attributedTo: uid,
			// conversation,
			content,
			sourceContent,
			inReplyTo: toPid,
		} = object;

		const timestamp = new Date(published);
		let edited = new Date(updated);
		edited = Number.isNaN(edited.valueOf()) ? 0 : edited;

		// If no source content, then `content` is pre-parsed and should be HTML, so cache it
		if (!sourceContent) {
			winston.verbose(`[activitypub/mockPost] pid ${pid} already has pre-parsed HTML content, adding to post cache...`);
			postCache.set(pid, content);
		}

		const payload = {
			uid,
			pid,
			timestamp: timestamp.getTime(),
			timestampISO: timestamp.toISOString(),
			content: sourceContent || content,
			toPid,

			edited,
			editor: edited ? uid : undefined,
			editedISO: edited ? edited.toISOString() : '',

			deleted: 0,
			deleterUid: 0,
			replies: 0, // todo
			bookmarks: 0,
			votes: 0, // todo
		};

		return payload;
	}))).filter(Boolean);

	return single ? posts.pop() : posts;
};
