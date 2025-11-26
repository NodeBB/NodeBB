'use strict';

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');

const activitypub = module.parent.exports;
const Contexts = module.exports;

Contexts.get = async (uid, id) => {
	let context;
	let type;

	// Generate digest for If-None-Match if locally cached
	const tid = await posts.getPostField(id, 'tid');
	const headers = {};
	if (tid) {
		const [mainPid, pids] = await Promise.all([
			topics.getTopicField(tid, 'mainPid'),
			db.getSortedSetMembers(`tid:${tid}:posts`),
		]);
		pids.push(mainPid);
		const digest = activitypub.helpers.generateDigest(new Set(pids));
		headers['If-None-Match'] = `"${digest}"`;
	}

	try {
		({ id, type, context } = await activitypub.get('uid', uid, id, { headers }));
		if (activitypub._constants.acceptable.contextTypes.has(type)) { // is context
			activitypub.helpers.log(`[activitypub/context] ${id} is the context.`);
			return { context: id };
		} else if (!context) {
			activitypub.helpers.log(`[activitypub/context] ${id} contains no context.`);
			return false;
		}

		// context provided; try to resolve it.
		({ type } = await activitypub.get('uid', uid, context));
	} catch (e) {
		if (e.code === 'ap_get_304') {
			activitypub.helpers.log(`[activitypub/context] ${id} context unchanged.`);
			return { tid };
		}

		activitypub.helpers.log(`[activitypub/context] ${id} context not resolvable.`);
		return false;
	}

	if (activitypub._constants.acceptable.contextTypes.has(type)) {
		return { context };
	}

	return false;
};

Contexts.getItems = async (uid, id, options) => {
	if (!options.hasOwnProperty('root')) {
		options.root = true;
	}

	// Page object instead of id
	let object;
	if (!id && options.object) {
		object = options.object;
	} else {
		activitypub.helpers.log(`[activitypub/context] Retrieving context/page ${id}`);
		try {
			object = await activitypub.get('uid', uid, id);
		} catch (e) {
			return false;
		}
	}
	let { type, items, orderedItems, first, next } = object;

	if (!activitypub._constants.acceptable.contextTypes.has(type)) {
		return false;
	}

	if (type.startsWith('Ordered') && orderedItems) {
		items = orderedItems;
	}

	if (items) {
		if (options.returnRootId) {
			return items.pop();
		}

		items = await Promise.all(items
			.map(async item => (activitypub.helpers.isUri(item) ? parseString(uid, item) : parseItem(uid, item))));
		items = items.filter(Boolean);
		activitypub.helpers.log(`[activitypub/context] Found ${items.length} items.`);
	}

	const chain = new Set(items || []);
	if (!next && options.root && first) {
		next = first;
	}

	// Early breakout on empty collection
	if (!next && !chain.size) {
		return new Set();
	}

	if (next) {
		activitypub.helpers.log('[activitypub/context] Fetching next page...');
		const isUrl = activitypub.helpers.isUri(next);
		Array
			.from(await Contexts.getItems(uid, isUrl && next, {
				...options,
				root: false,
				object: !isUrl && next,
			}))
			.forEach((item) => {
				chain.add(item);
			});

		return chain;
	}

	return chain;
};

async function parseString(uid, item) {
	const { type, id } = await activitypub.helpers.resolveLocalId(item);
	const pid = type === 'post' && id ? id : item;
	const postData = await posts.getPostData(pid);
	if (postData) {
		// Already cached
		return postData;
	}

	// No local copy, fetch from source
	try {
		const object = await activitypub.get('uid', uid, pid);
		activitypub.helpers.log(`[activitypub/context] Retrieved ${pid}`);

		return parseItem(uid, object);
	} catch (e) {
		// Unresolvable, either temporarily or permanent, ignore for now.
		activitypub.helpers.log(`[activitypub/context] Cannot retrieve ${pid}`);
		return null;
	}
}

async function parseItem(uid, item) {
	const { type, id } = await activitypub.helpers.resolveLocalId(item.id);
	const pid = type === 'post' && id ? id : item.id;
	const postData = await posts.getPostData(pid);
	if (postData) {
		// Already cached
		return postData;
	}

	// Handle activity wrapper
	if (item.type === 'Create') {
		item = item.object;
		if (activitypub.helpers.isUri(item)) {
			return parseString(uid, item);
		}
	} else if (!activitypub._constants.acceptedPostTypes.includes(item.type)) {
		// Not a note, silently skip.
		return null;
	}

	activitypub.helpers.log(`[activitypub/context] Parsing ${pid}`);
	return await activitypub.mocks.post(item);
}
