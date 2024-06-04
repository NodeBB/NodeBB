'use strict';

const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const batch = require('../batch');
const meta = require('../meta');
const privileges = require('../privileges');
const categories = require('../categories');
const user = require('../user');
const topics = require('../topics');
const posts = require('../posts');
const utils = require('../utils');

const activitypub = module.parent.exports;
const Notes = module.exports;

async function lock(value) {
	const count = await db.incrObjectField('locks', value);
	return count <= 1;
}

async function unlock(value) {
	await db.deleteObjectField('locks', value);
}

Notes.assert = async (uid, input, options = { skipChecks: false }) => {
	/**
	 * Given the id or object of any as:Note, traverses up to cache the entire threaded context
	 *
	 * Unfortunately, due to limitations and fragmentation of the existing ActivityPub landscape,
	 * retrieving the entire reply tree is not possible at this time.
	 */

	const object = !activitypub.helpers.isUri(input) && input;
	const id = object ? object.id : input;

	const lockStatus = await lock(id, '[[error:activitypub.already-asserting]]');
	if (!lockStatus) { // unable to achieve lock, stop processing.
		return null;
	}

	const chain = Array.from(await Notes.getParentChain(uid, input));
	if (!chain.length) {
		unlock(id);
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
		unlock(id);
		return { tid, count: 0 };
	}

	let cid;
	let title;
	if (hasTid) {
		({ cid, mainPid } = await topics.getTopicFields(tid, ['tid', 'cid', 'mainPid']));

		if (options.cid && cid === -1) {
			// Move topic
			await topics.tools.move(tid, { cid: options.cid, uid: 'system' });
		}
	} else {
		// mainPid ok to leave as-is
		cid = options.cid || -1;
		title = name || activitypub.helpers.generateTitle(utils.decodeHTMLEntities(content));
	}
	mainPid = utils.isNumber(mainPid) ? parseInt(mainPid, 10) : mainPid;

	// Relation & privilege check for local categories
	const hasRelation = uid || options.skipChecks || options.cid || hasTid || await assertRelation(chain[0]);
	const privilege = `topics:${tid ? 'reply' : 'create'}`;
	const allowed = await privileges.categories.can(privilege, cid, activitypub._constants.uid);
	if (!hasRelation || !allowed) {
		if (!hasRelation) {
			winston.info(`[activitypub/notes.assert] Not asserting ${id} as it has no relation to existing tracked content.`);
		}

		unlock(id);
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
			posts.attachments.update(mainPid, attachment),
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
			posts.attachments.update(post.pid, attachment),
		]);

		// Category announce
		if (object && object.id === post.pid) {
			// eslint-disable-next-line no-await-in-loop
			const followers = await activitypub.notes.getCategoryFollowers(cid);
			// eslint-disable-next-line no-await-in-loop
			await activitypub.send('cid', cid, followers, {
				id: `${object.id}#activity/announce`,
				type: 'Announce',
				to: [`${nconf.get('url')}/category/${cid}/followers`],
				cc: [activitypub._constants.publicAddress],
				object,
			});
		}
	}

	await Promise.all([
		Notes.syncUserInboxes(tid, uid),
		unlock(id),
	]);

	return { tid, count };
};

async function assertRelation(post) {
	/**
	 * Given a mocked post object, ensures that it is related to some other object in database
	 * This check ensures that random content isn't added to the database just because it is received.
	 */

	// Is followed by at least one local user
	const numFollowers = await activitypub.actors.getLocalFollowersCount(post.uid);

	// Local user is mentioned
	const { tag } = post._activitypub;
	let uids = [];
	if (tag && tag.length) {
		const slugs = tag.reduce((slugs, tag) => {
			if (tag.type === 'Mention') {
				const [slug, hostname] = tag.name.slice(1).split('@');
				if (hostname === nconf.get('url_parsed').hostname) {
					slugs.push(slug);
				}
			}
			return slugs;
		}, []);

		uids = slugs.length ? await db.sortedSetScores('userslug:uid', slugs) : [];
		uids = uids.filter(Boolean);
	}

	return numFollowers > 0 || uids.length;
}

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
			const { uids: followers } = await activitypub.actors.getLocalFollowers(followedUid);
			if (followers.size > 0) {
				followers.forEach((uid) => {
					uids.add(uid);
				});
			}
		}
	}));

	if (uids.size > 0) {
		await db.setAdd(`post:${id}:recipients`, Array.from(uids));
	}
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
			let object = !activitypub.helpers.isUri(input) && input.id === id ? input : undefined;
			try {
				object = object || await activitypub.get('uid', uid, id);

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

Notes.syncUserInboxes = async function (tid, uid) {
	const [pids, { cid, mainPid }] = await Promise.all([
		db.getSortedSetMembers(`tid:${tid}:posts`),
		topics.getTopicFields(tid, ['tid', 'cid', 'mainPid']),
	]);
	pids.unshift(mainPid);

	const recipients = await db.getSetsMembers(pids.map(id => `post:${id}:recipients`));
	const uids = recipients.reduce((set, uids) => new Set([...set, ...uids.map(u => parseInt(u, 10))]), new Set());
	if (uid) {
		uids.add(parseInt(uid, 10));
	}

	const keys = Array.from(uids).map(uid => `uid:${uid}:inbox`);
	const score = await db.sortedSetScore(`cid:${cid}:tids`, tid);

	winston.verbose(`[activitypub/syncUserInboxes] Syncing tid ${tid} with ${uids.size} inboxes`);
	await Promise.all([
		db.sortedSetsAdd(keys, keys.map(() => score || Date.now()), tid),
		db.setAdd(`tid:${tid}:recipients`, Array.from(uids)),
	]);
};

Notes.getCategoryFollowers = async (cid) => {
	// Retrieves remote users who have followed a category; used to build recipient list
	let uids = await db.getSortedSetRangeByScore(`cid:${cid}:uid:watch:state`, 0, -1, categories.watchStates.tracking, categories.watchStates.tracking);
	uids = uids.filter(uid => !utils.isNumber(uid));

	return uids;
};

Notes.announce = {};

Notes.announce.list = async ({ pid, tid }) => {
	let pids = [];
	if (pid) {
		pids = [pid];
	} else if (tid) {
		let mainPid;
		([pids, mainPid] = await Promise.all([
			db.getSortedSetMembers(`tid:${tid}:posts`),
			topics.getTopicField(tid, 'mainPid'),
		]));
		pids.unshift(mainPid);
	}

	if (!pids.length) {
		return [];
	}

	const keys = pids.map(pid => `pid:${pid}:announces`);
	let announces = await db.getSortedSetsMembersWithScores(keys);
	announces = announces.reduce((memo, cur, idx) => {
		if (cur.length) {
			const pid = pids[idx];
			cur.forEach(({ value: actor, score: timestamp }) => {
				memo.push({ pid, actor, timestamp });
			});
		}
		return memo;
	}, []);

	return announces;
};

Notes.announce.add = async (pid, actor, timestamp = Date.now()) => {
	await db.sortedSetAdd(`pid:${pid}:announces`, timestamp, actor);
};

Notes.announce.remove = async (pid, actor) => {
	await db.sortedSetRemove(`pid:${pid}:announces`, actor);
};

Notes.announce.removeAll = async (pid) => {
	await db.delete(`pid:${pid}:announces`);
};

Notes.delete = async (pids) => {
	if (!Array.isArray(pids)) {
		pids = [pids];
	}

	const exists = await posts.exists(pids);
	pids = pids.filter((_, idx) => exists[idx]);

	const recipientSets = pids.map(id => `post:${id}:recipients`);
	const announcerSets = pids.map(id => `pid:${id}:announces`);

	await db.deleteAll([...recipientSets, ...announcerSets]);
};

Notes.prune = async () => {
	/**
	 * Prune topics in cid -1 that have received no engagement.
	 * Engagement is defined as:
	 *   - Replied to (contains a local reply)
	 *   - Post within is liked
	 */
	winston.verbose('[notes/prune] Starting scheduled pruning of topics');
	const start = 0;
	const stop = Date.now() - (1000 * 60 * 60 * 24 * 30); // 30 days; todo: make configurable?
	let tids = await db.getSortedSetRangeByScore('cid:-1:tids', 0, -1, start, stop);

	winston.verbose(`[notes/prune] Found ${tids.length} topics older than 30 days (since last activity).`);

	const posters = await db.getSortedSetsMembers(tids.map(tid => `tid:${tid}:posters`));
	const hasLocalVoter = await Promise.all(tids.map(async (tid) => {
		const mainPid = await db.getObjectField(`topic:${tid}`, 'mainPid');
		const pids = await db.getSortedSetMembers(`tid:${tid}:posts`);
		pids.unshift(mainPid);

		// Check voters of each pid for a local uid
		const voters = new Set();
		await Promise.all(pids.map(async (pid) => {
			const [upvoters, downvoters] = await db.getSetsMembers([`pid:${pid}:upvote`, `pid:${pid}:downvote`]);
			upvoters.forEach(uid => voters.add(uid));
			downvoters.forEach(uid => voters.add(uid));
		}));

		return Array.from(voters).some(uid => utils.isNumber(uid));
	}));

	tids = tids.filter((_, idx) => {
		const localPoster = posters[idx].some(uid => utils.isNumber(uid));
		const localVoter = hasLocalVoter[idx];

		return !localPoster && !localVoter;
	});

	winston.verbose(`[notes/prune] ${tids.length} topics eligible for pruning`);

	await batch.processArray(tids, async (tids) => {
		await Promise.all(tids.map(async (tid) => {
			topics.purgePostsAndTopic(tid, 0);
		}));
	}, { batch: 100 });
};
