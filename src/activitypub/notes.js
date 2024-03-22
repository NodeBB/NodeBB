'use strict';

const winston = require('winston');
const crypto = require('crypto');

const db = require('../database');
const meta = require('../meta');
const privileges = require('../privileges');
const categories = require('../categories');
const user = require('../user');
const topics = require('../topics');
const posts = require('../posts');
const utils = require('../utils');

const activitypub = module.parent.exports;
const Notes = module.exports;

Notes.assert = async (uid, id) => {
	/**
	 * Given the id of any post, traverses up to cache the entire threaded context
	 *
	 * Unfortunately, due to limitations and fragmentation of the existing ActivityPub landscape,
	 * retrieving the entire reply tree is not possible at this time.
	 */

	const chain = Array.from(await Notes.getParentChain(uid, id));
	if (!chain.length) {
		return null;
	}

	const mainPost = chain[chain.length - 1];
	let { pid: mainPid, tid, uid: authorId, timestamp, name, content } = mainPost;
	const hasTid = !!tid;

	const members = await db.isSortedSetMembers(`tid:${tid}:posts`, chain.slice(0, -1).map(p => p.pid));
	members.push(await posts.exists(mainPid));
	if (tid && members.every(Boolean)) {
		// All cached, return early.
		winston.verbose('[notes/assert] No new notes to process.');
		return tid;
	}

	let cid;
	let title;
	if (hasTid) {
		({ cid, mainPid } = await topics.getTopicFields(tid, ['tid', 'cid', 'mainPid']));
	} else {
		// mainPid ok to leave as-is
		cid = -1;
		title = name || utils.decodeHTMLEntities(utils.stripHTMLTags(content));
		if (title.length > meta.config.maximumTitleLength) {
			title = `${title.slice(0, meta.config.maximumTitleLength - 3)}...`;
		}
	}
	mainPid = utils.isNumber(mainPid) ? parseInt(mainPid, 10) : mainPid;

	// Privilege check for local categories
	const privilege = `topics:${tid ? 'reply' : 'create'}`;
	const allowed = await privileges.categories.can(privilege, cid, activitypub._constants.uid);
	if (!allowed) {
		return null;
	}

	tid = tid || utils.generateUUID();
	mainPost.tid = tid;

	const unprocessed = chain.map((post) => {
		post.tid = tid; // add tid to post hash
		return post;
	}).filter((p, idx) => !members[idx]);
	const count = unprocessed.length;
	winston.verbose(`[notes/assert] ${count} new note(s) found.`);

	const [ids, timestamps] = [
		unprocessed.map(n => (utils.isNumber(n.pid) ? parseInt(n.pid, 10) : n.pid)),
		unprocessed.map(n => n.timestamp),
	];

	// mainPid doesn't belong in posts zset
	if (ids.includes(mainPid)) {
		const idx = ids.indexOf(mainPid);
		ids.splice(idx, 1);
		timestamps.splice(idx, 1);
	}

	let tags;
	if (!hasTid) {
		const { to, cc, attachment } = mainPost._activitypub;
		const systemTags = (meta.config.systemTags || '').split(',');
		const maxTags = await categories.getCategoryField(cid, 'maxTags');
		tags = (mainPost._activitypub.tag || [])
			.filter(o => o.type === 'Hashtag' && !systemTags.includes(o.name.slice(1)))
			.map(o => o.name.slice(1));

		if (maxTags && tags.length > maxTags) {
			tags.length = maxTags;
		}

		await Promise.all([
			topics.post({
				tid,
				uid: authorId,
				cid,
				pid: mainPid,
				title,
				timestamp,
				tags,
				content: mainPost.content,
				_activitypub: mainPost._activitypub,
			}),
			Notes.updateLocalRecipients(mainPid, { to, cc }),
			Notes.saveAttachments(mainPid, attachment),
		]);
		unprocessed.pop();
	}

	unprocessed.reverse();
	for (const post of unprocessed) {
		const { to, cc, attachment } = post._activitypub;

		// eslint-disable-next-line no-await-in-loop
		await Promise.all([
			topics.reply(post),
			Notes.updateLocalRecipients(post.pid, { to, cc }),
			Notes.saveAttachments(post.pid, attachment),
		]);
	}

	await Notes.syncUserInboxes(tid);

	return { tid, count };
};

Notes.updateLocalRecipients = async (id, { to, cc }) => {
	const recipients = new Set([...(to || []), ...(cc || [])]);
	const uids = new Set();
	await Promise.all(Array.from(recipients).map(async (recipient) => {
		const { type, id } = await activitypub.helpers.resolveLocalId(recipient);
		if (type === 'user' && await user.exists(id)) {
			uids.add(parseInt(id, 10));
			return;
		}

		const followedUid = await db.getObjectField('followersUrl:uid', recipient);
		if (followedUid) {
			const followers = await db.getSortedSetMembers(`followersRemote:${followedUid}`);
			if (followers.length) {
				uids.add(...followers.map(uid => parseInt(uid, 10)));
			}
			// return;
		}
	}));

	if (uids.size > 0) {
		await db.setAdd(`post:${id}:recipients`, Array.from(uids));
	}
};

Notes.saveAttachments = async (id, attachments) => {
	if (!attachments) {
		return;
	}

	const bulkOps = {
		hash: [],
		zset: {
			score: [],
			value: [],
		},
	};

	attachments.filter(Boolean).forEach(({ mediaType, url, name, width, height }, idx) => {
		if (!url) { // only required property
			return;
		}

		const hash = crypto.createHash('sha256').update(url).digest('hex');
		const key = `attachment:${hash}`;

		bulkOps.hash.push([key, { mediaType, url, name, width, height }]);
		bulkOps.zset.score.push(idx);
		bulkOps.zset.value.push(hash);
	});

	await Promise.all([
		db.setObjectBulk(bulkOps.hash),
		db.sortedSetAdd(`post:${id}:attachments`, bulkOps.zset.score, bulkOps.zset.value),
	]);
};

Notes.getParentChain = async (uid, input) => {
	// Traverse upwards via `inReplyTo` until you find the root-level Note
	const id = activitypub.helpers.isUri(input) ? input : input.id;

	const chain = new Set();
	const traverse = async (uid, id) => {
		// Handle remote reference to local post
		const { type, id: localId } = await activitypub.helpers.resolveLocalId(id);
		if (type === 'post' && localId) {
			return await traverse(uid, localId);
		}

		const exists = await db.exists(`post:${id}`);
		if (exists) {
			const postData = await posts.getPostData(id);
			chain.add(postData);
			if (postData.toPid) {
				await traverse(uid, postData.toPid);
			} else if (utils.isNumber(id)) { // local pid without toPid, could be OP or reply to OP
				const mainPid = await topics.getTopicField(postData.tid, 'mainPid');
				if (mainPid !== parseInt(id, 10)) {
					await traverse(uid, mainPid);
				}
			}
		} else {
			let object;
			try {
				object = await activitypub.get('uid', uid, id);

				// Handle incorrect id passed in
				if (id !== object.id) {
					return await traverse(uid, object.id);
				}

				object = await activitypub.mocks.post(object);
				if (object) {
					chain.add(object);
					if (object.toPid) {
						await traverse(uid, object.toPid);
					}
				}
			} catch (e) {
				winston.warn(`[activitypub/notes/getParentChain] Cannot retrieve ${id}, terminating here.`);
			}
		}
	};

	await traverse(uid, id);
	return chain;
};

Notes.syncUserInboxes = async function (tid) {
	const [pids, { cid, mainPid }] = await Promise.all([
		db.getSortedSetMembers(`tid:${tid}:posts`),
		topics.getTopicFields(tid, ['tid', 'cid', 'mainPid']),
	]);
	pids.unshift(mainPid);

	const recipients = await db.getSetsMembers(pids.map(id => `post:${id}:recipients`));
	const uids = recipients.reduce((set, uids) => new Set([...set, ...uids.map(u => parseInt(u, 10))]), new Set());
	const keys = Array.from(uids).map(uid => `uid:${uid}:inbox`);
	const score = await db.sortedSetScore(`cid:${cid}:tids`, tid);

	winston.verbose(`[activitypub/syncUserInboxes] Syncing tid ${tid} with ${uids.size} inboxes`);
	await db.sortedSetsAdd(keys, keys.map(() => score || Date.now()), tid);
};

Notes.getCategoryFollowers = async (cid) => {
	// Retrieves remote users who have followed a category; used to build recipient list
	let uids = await db.getSortedSetRangeByScore(`cid:${cid}:uid:watch:state`, 0, -1, categories.watchStates.tracking, categories.watchStates.tracking);
	uids = uids.filter(uid => !utils.isNumber(uid));

	return uids;
};
