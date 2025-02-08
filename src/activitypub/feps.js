'use strict';

const nconf = require('nconf');
const winston = require('winston');

const posts = require('../posts');
const utils = require('../utils');

const activitypub = module.parent.exports;
const Feps = module.exports;

Feps.announce = async function announce(id, activity) {
	let localId;
	if (String(id).startsWith(nconf.get('url'))) {
		({ id: localId } = await activitypub.helpers.resolveLocalId(id));
	}
	const cid = await posts.getCidByPid(localId || id);
	const uid = await posts.getPostField(localId || id, 'uid');

	const followers = await activitypub.notes.getCategoryFollowers(cid);
	if (!followers.length) {
		return;
	}

	const { actor } = activity;
	if (actor && !actor.startsWith(nconf.get('url'))) {
		followers.unshift(actor);
	}

	winston.info(`[activitypub/inbox.announce(1b12)] Announcing ${activity.type} to followers of cid ${cid}`);
	await activitypub.send('cid', cid, followers, {
		id: `${nconf.get('url')}/post/${encodeURIComponent(id)}#activity/announce/${Date.now()}`,
		type: 'Announce',
		actor: utils.isNumber(uid) ? `${nconf.get('url')}/uid/${uid}` : uid,
		to: [`${nconf.get('url')}/category/${cid}/followers`],
		cc: [actor, activitypub._constants.publicAddress],
		object: activity,
	});
};
