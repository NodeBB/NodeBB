'use strict';

const nconf = require('nconf');

const posts = require('../posts');

const activitypub = module.parent.exports;
const Feps = module.exports;

Feps.announce = async function announce(id, activity) {
	let localId;
	if (String(id).startsWith(nconf.get('url'))) {
		({ id: localId } = await activitypub.helpers.resolveLocalId(id));
	}
	const cid = await posts.getCidByPid(localId || id);
	if (cid === -1) {
		return;
	}

	const followers = await activitypub.notes.getCategoryFollowers(cid);
	if (!followers.length) {
		return;
	}

	const { actor } = activity;
	if (actor && !actor.startsWith(nconf.get('url'))) {
		followers.unshift(actor);
	}

	activitypub.helpers.log(`[activitypub/inbox.announce(1b12)] Announcing ${activity.type} (${activity.id}) to followers of cid ${cid}`);
	await Promise.all([activity, activity.object].map(async (object) => {
		await activitypub.send('cid', cid, followers, {
			id: `${nconf.get('url')}/post/${encodeURIComponent(id)}#activity/announce/${Date.now()}`,
			type: 'Announce',
			actor: `${nconf.get('url')}/category/${cid}`,
			to: [`${nconf.get('url')}/category/${cid}/followers`],
			cc: [actor, activitypub._constants.publicAddress],
			object,
		});
	}));
};

Feps.announceObject = async function announceObject(id) {
	let localId;
	if (String(id).startsWith(nconf.get('url'))) {
		({ id: localId } = await activitypub.helpers.resolveLocalId(id));
	}
	const cid = await posts.getCidByPid(localId || id);
	if (cid === -1) {
		return;
	}

	const followers = await activitypub.notes.getCategoryFollowers(cid);
	if (!followers.length) {
		return;
	}

	const author = await posts.getPostField(id, 'uid');
	if (!author.startsWith(nconf.get('url'))) {
		followers.unshift(author);
	}

	activitypub.helpers.log(`[activitypub/inbox.announce(1b12)] Announcing object (${id}) to followers of cid ${cid}`);
	await activitypub.send('cid', cid, followers, {
		id: `${nconf.get('url')}/post/${encodeURIComponent(id)}#activity/announce/${Date.now()}`,
		type: 'Announce',
		actor: `${nconf.get('url')}/category/${cid}`,
		to: [`${nconf.get('url')}/category/${cid}/followers`],
		cc: [author, activitypub._constants.publicAddress],
		object: id,
	});
};
