'use strict';

const nconf = require('nconf');

const posts = require('../posts');
const topics = require('../topics');
const utils = require('../utils');

const activitypub = module.parent.exports;
const Feps = module.exports;

Feps.announce = async function announce(id, activity) {
	let localId;
	if (String(id).startsWith(nconf.get('url'))) {
		({ id: localId } = await activitypub.helpers.resolveLocalId(id));
	}

	/**
	 * Re-broadcasting occurs on
	 *  - local cids (for all tids), and
	 *  - local tids (posted to remote cids) only
	 */
	const tid = await posts.getPostField(localId || id, 'tid');
	const cid = await topics.getTopicField(tid, 'cid');
	const localCid = utils.isNumber(cid) && cid > 0;
	const addressed = activitypub.helpers.addressed(cid, activity);
	const shouldAnnounce = localCid || (utils.isNumber(tid) && !addressed);
	if (!shouldAnnounce) { // inverse conditionals can kiss my ass.
		return;
	}

	let relays = await activitypub.relays.list();
	relays = relays.reduce((memo, { state, url }) => {
		if (state === 2) {
			memo.push(url);
		}
		return memo;
	}, []);
	const followers = localCid ? await activitypub.notes.getCategoryFollowers(cid) : [cid];
	const targets = relays.concat(followers);
	if (!targets.length) {
		return;
	}

	const { actor } = activity;
	if (localCid && actor && !actor.startsWith(nconf.get('url'))) {
		targets.unshift(actor);
	}
	const now = Date.now();
	const to = [localCid ? `${nconf.get('url')}/category/${cid}/followers` : cid];
	const cc = [activitypub._constants.publicAddress];
	if (localCid) {
		cc.unshift(actor);
	}

	if (activity.type === 'Create') {
		const isMain = await posts.isMain(localId || id);
		if (isMain) {
			activitypub.helpers.log(`[activitypub/inbox.announce(1b12)] Announcing plain object (${activity.id}) to followers of cid ${cid} and ${relays.length} relays`);
			await activitypub.send('cid', localCid ? cid : 0, targets, {
				id: `${nconf.get('url')}/post/${encodeURIComponent(id)}#activity/announce/${localCid ? `cid/${cid}` : 'uid/0'}`,
				type: 'Announce',
				actor: localCid ? `${nconf.get('url')}/category/${cid}` : `${nconf.get('url')}/actor`,
				to,
				cc,
				object: activity.object,
			});
		}
	}

	activitypub.helpers.log(`[activitypub/inbox.announce(1b12)] Announcing ${activity.type} (${activity.id}) to followers of cid ${cid} and ${relays.length} relays`);
	await activitypub.send('cid', localCid ? cid : 0, targets, {
		id: `${nconf.get('url')}/post/${encodeURIComponent(id)}#activity/announce/${now}`,
		type: 'Announce',
		actor: localCid ? `${nconf.get('url')}/category/${cid}` : `${nconf.get('url')}/actor`,
		to,
		cc,
		object: activity,
	});
};
