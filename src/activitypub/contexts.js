'use strict';

const winston = require('winston');

const posts = require('../posts');

const activitypub = module.parent.exports;
const Contexts = module.exports;

const acceptableTypes = ['Collection', 'CollectionPage', 'OrderedCollection', 'OrderedCollectionPage'];

Contexts.get = async (uid, id) => {
	let context;
	let type;

	try {
		({ context } = await activitypub.get('uid', uid, id));
		({ type } = await activitypub.get('uid', uid, context));
	} catch (e) {
		winston.verbose(`[activitypub/context] ${id} context not resolvable.`);
		return false;
	}

	if (acceptableTypes.includes(type)) {
		return context;
	}

	return false;
};

Contexts.getItems = async (uid, id, root = true) => {
	winston.verbose(`[activitypub/context] Retrieving context ${id}`);
	let { type, items, orderedItems, first, next } = await activitypub.get('uid', uid, id);
	if (!acceptableTypes.includes(type)) {
		return [];
	}

	if (type.startsWith('Ordered') && orderedItems) {
		items = orderedItems;
	}

	if (items) {
		items = await Promise.all(items
			.map(async item => (activitypub.helpers.isUri(item) ? parseString(uid, item) : parseItem(uid, item))));
		items = items.filter(Boolean);
		winston.verbose(`[activitypub/context] Found ${items.length} items.`);
	}

	const chain = new Set(items || []);
	if (!next && root && first) {
		next = first;
	}

	if (next) {
		winston.verbose('[activitypub/context] Fetching next page...');
		Array
			.from(await Contexts.getItems(uid, next, false))
			.forEach((item) => {
				chain.add(item);
			});
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
		winston.verbose(`[activitypub/context] Retrieved ${pid}`);

		return parseItem(uid, object);
	} catch (e) {
		// Unresolvable, either temporarily or permanent, ignore for now.
		winston.verbose(`[activitypub/context] Cannot retrieve ${id}`);
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

	winston.verbose(`[activitypub/context] Parsing ${pid}`);
	return await activitypub.mocks.post(item);
}
