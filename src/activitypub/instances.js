'use strict';

const meta = require('../meta');
const db = require('../database');
const activitypub = module.parent.exports;

const Instances = module.exports;

Instances.log = async (domain) => {
	await db.sortedSetAdd('instances:lastSeen', Date.now(), domain);
};

Instances.getCount = async () => db.sortedSetCard('instances:lastSeen');

Instances.list = async () => db.getSortedSetMembers('instances:lastSeen');

Instances.isAllowed = async (domain) => {
	const result = await activitypub.blocklists.check(domain);
	await activitypub.blocklists.core.ensure();
	const core = await activitypub.blocklists.get('core');
	const { activitypubFilter: type } = meta.config;

	if (!type) {
		// type = 0: blocklist mode — deny if domain is on the core list with severity <= silence
		if (result.allowed) {
			const coreDomain = core.domains.find(d => d.domain === domain);
			const coreSeverity = coreDomain ? coreDomain.severity : null;
			const coreBlocked = coreSeverity && coreSeverity !== 'filter';
			return { ...result, allowed: !coreBlocked };
		}

		return result;
	}

	// type = 1: allowlist mode — allow only if domain is on the core list
	return { ...result, allowed: core.domains.some(d => d.domain === domain) };
};
