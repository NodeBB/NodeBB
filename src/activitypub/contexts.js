'use strict';

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');

const activitypub = module.parent.exports;
const Contexts = module.exports;

const acceptableTypes = ['Collection', 'CollectionPage', 'OrderedCollection', 'OrderedCollectionPage'];

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
		({ context } = await activitypub.get('uid', uid, id, { headers }));
		if (!context) {
			activitypub.helpers.log(`[activitypub/context] ${id} contains no context.`);
			return false;
		}
		({ type } = await activitypub.get('uid', uid, context));
	} catch (e) {
		if (e.code === 'ap_get_304') {
			activitypub.helpers.log(`[activitypub/context] ${id} context unchanged.`);
			return { tid };
		}

		activitypub.helpers.log(`[activitypub/context] ${id} context not resolvable.`);
		return false;
	}

	if (acceptableTypes.includes(type)) {
		return { context };
	}

	return false;
};

Contexts.getItems = async (uid, id, options) => {
	if (!options.hasOwnProperty('root')) {
		options.root = true;
	}

	activitypub.helpers.log(`[activitypub/context] Retrieving context ${id}`);
	let { type, items, orderedItems, first, next } = await activitypub.get('uid', uid, id);
	if (!acceptableTypes.includes(type)) {
		return false;
	}

	if (type.startsWith('Ordered') && orderedItems) {
		items = orderedItems;
	}

	if (items) {
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
		Array
			.from(await Contexts.getItems(uid, next, {
				...options,
				root: false,
			}))
			.forEach((item) => {
				chain.add(item);
			});
	}

	// Handle special case where originating object is not actually part of the context collection
	const inputId = activitypub.helpers.isUri(options.input) ? options.input : options.input.id;
	const inCollection = Array.from(chain).map(p => p.pid).includes(inputId);
	if (!inCollection) {
		chain.add(activitypub.helpers.isUri(options.input) ?
			await parseString(uid, options.input) :
			await parseItem(uid, options.input));
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
