'use strict';

const assert = require('assert');
const nconf = require('nconf');
const utils = require('../../src/utils');

const activitypub = require('../../src/activitypub');

const Helpers = module.exports;

Helpers.genSplitDomain = () => {
	const username = `user_${utils.generateUUID().replace(/-/g, '').slice(0, 8)}`;
	const domainA = `forum-${utils.generateUUID().replace(/-/g, '').slice(0, 6)}.example`;
	const domainB = `ap-${utils.generateUUID().replace(/-/g, '').slice(0, 6)}.example`;
	const actorUri = `https://${domainB}/uid/${username}`;
	return { domainA, domainB, username, actorUri, preferredUsername: username };
};

Helpers.seedWebfinger = (domainA, domainB, username, actorUri) => {
	activitypub.helpers._webfingerCache.set(`${username}@${domainB}`, {
		actorUri, username, hostname: domainB,
		subject: `acct:${username}@${domainA}`, splitDomain: true, subjectHostname: domainA,
		_raw: {
			links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
			publicKey: null, subject: `acct:${username}@${domainA}`,
		},
	});
	activitypub.helpers._webfingerCache.set(`${username}@${domainA}`, {
		actorUri, username, hostname: domainA,
		subject: `acct:${username}@${domainA}`, splitDomain: false, subjectHostname: domainA,
		_raw: {
			links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
			publicKey: null, subject: `acct:${username}@${domainA}`,
		},
	});
};

Helpers.seedSameDomainWebfinger = (domainB, username, actorUri) => {
	activitypub.helpers._webfingerCache.set(`${username}@${domainB}`, {
		actorUri, username, hostname: domainB,
		subject: `acct:${username}@${domainB}`, splitDomain: false, subjectHostname: domainB,
		_raw: {
			links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
			publicKey: null, subject: `acct:${username}@${domainB}`,
		},
	});
};

Helpers.seedActor = (actorUri, overrides = {}) => {
	const actor = {
		'@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
		id: actorUri, url: actorUri, inbox: `${actorUri}/inbox`, outbox: `${actorUri}/outbox`,
		type: 'Person', name: overrides.name || overrides.preferredUsername || 'User',
		preferredUsername: overrides.preferredUsername || 'user',
		publicKey: { id: `${actorUri}#key`, owner: actorUri, publicKeyPem: 'test-key' },
		followers: `${actorUri}/followers`, following: `${actorUri}/following`,
		...overrides,
	};
	activitypub._cache.set(`0;${actorUri}`, actor);
	return actor;
};

Helpers.reset = () => {
	activitypub._cache.reset();
	activitypub.helpers._webfingerCache.reset();
	nconf.set('activitypubAllowSplitDomain', 1);
	nconf.set('activitypubAllowLoopback', 0);
};

// ============================================================================

describe('helpers.query strictness', () => {
	beforeEach(Helpers.reset);

	it('strict query of same-domain subject returns payload with splitDomain: false', async () => {
		const { domainA, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedSameDomainWebfinger(domainA, username, actorUri);
		const result = await activitypub.helpers.query(`${username}@${domainA}`);
		assert.ok(result);
		assert.equal(result.actorUri, actorUri);
		assert.equal(result.splitDomain, false);
	});

	it('strict query of split-domain subject returns false', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		const result = await activitypub.helpers.query(`${username}@${domainB}`);
		assert.equal(result, false);
	});

	it('non-strict query of split-domain subject returns full payload', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		const result = await activitypub.helpers.query(`${username}@${domainB}`, { strict: false });
		assert.ok(result);
		assert.equal(result.actorUri, actorUri);
		assert.equal(result.splitDomain, true);
		assert.equal(result.hostname, domainB);
		assert.equal(result.subjectHostname, domainA);
	});

	it('cached split-domain payload is still rejected by strict query', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		const result = await activitypub.helpers.query(`${username}@${domainB}`);
		assert.equal(result, false);
	});
});

// ============================================================================

describe('verifyActorWebfinger', () => {
	beforeEach(Helpers.reset);

	it('returns split-domain verdict for fully verified actor', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.ok(verdict.ok);
		assert.equal(verdict.splitDomain, true);
		assert.equal(verdict.canonicalHandle, `${username}@${domainA}`);
		assert.equal(verdict.reason, 'split-domain');
	});

	it('returns same-domain verdict for same-domain actor', async () => {
		const { username, actorUri } = Helpers.genSplitDomain();
		const domain = new URL(actorUri).hostname;
		Helpers.seedSameDomainWebfinger(domain, username, actorUri);
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.ok(verdict.ok);
		assert.equal(verdict.splitDomain, false);
		assert.equal(verdict.canonicalHandle, `${username}@${domain}`);
	});

	it('rejects with no-backreference when domain B WebFinger 404s', async () => {
		const { domainA, username, actorUri } = Helpers.genSplitDomain();
		activitypub.helpers._webfingerCache.set(`${username}@${domainA}`, {
			actorUri, username, hostname: domainA,
			subject: `acct:${username}@${domainA}`, splitDomain: false, subjectHostname: domainA,
			_raw: {
				links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
				publicKey: null,
			},
		});
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'no-backreference');
	});

	it('rejects with subject-mismatch when backreference self-link points elsewhere', async () => {
		const { domainB, username, actorUri } = Helpers.genSplitDomain();
		const spoofedUri = `https://${domainB}/uid/spoofed_user`;
		activitypub.helpers._webfingerCache.set(`${username}@${domainB}`, {
			actorUri: spoofedUri, username, hostname: domainB,
			subject: `acct:${username}@${domainB}`, splitDomain: false, subjectHostname: domainB,
			_raw: {
				links: [{ rel: 'self', href: spoofedUri, type: 'application/activity+json' }],
				publicKey: null,
			},
		});
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'subject-mismatch');
	});

	it('rejects with forward-mismatch when forward query 404s', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		activitypub.helpers._webfingerCache.set(`${username}@${domainB}`, {
			actorUri, username, hostname: domainB,
			subject: `acct:${username}@${domainA}`, splitDomain: true, subjectHostname: domainA,
			_raw: {
				links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
				publicKey: null,
			},
		});
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'forward-mismatch');
	});

	it('rejects when split-domain config is off', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		Helpers.seedActor(actorUri, { preferredUsername: username });
		nconf.set('activitypubAllowSplitDomain', 0);
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'forward-mismatch');
	});

	it('rejects with canonical-blocked when domain A is blocklisted', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const origCheck = activitypub.instances._blocklists.check;
		activitypub.instances._blocklists.check = async (domain) => {
			if (domain === domainA) {
				return { allowed: false, severity: 'filter', listUrl: 'https://bad.example' };
			}
			return origCheck.call(activitypub.instances._blocklists, domain);
		};
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'canonical-blocked');
		activitypub.instances._blocklists.check = origCheck;
	});
});

// ============================================================================

describe('Actors.assert - hostname mismatch', () => {
	beforeEach(Helpers.reset);

	it('rejects when queried hostname differs from actor.id hostname (gh#13352)', async () => {
		const username = 'alice';
		const queriedDomain = 'honest.example';
		const actorDomain = 'spoof.example';
		const actorUri = `https://${actorDomain}/uid/${username}`;
		activitypub.helpers._webfingerCache.set(`${username}@${queriedDomain}`, {
			actorUri, username, hostname: queriedDomain,
			subject: `acct:${username}@${queriedDomain}`, splitDomain: false, subjectHostname: queriedDomain,
			_raw: {
				links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
				publicKey: null,
			},
		});
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const result = await activitypub.actors.assert([actorUri]);
		assert.equal(result, false);
	});

	it('accepts same-domain actors via full WebFinger verification', async () => {
		const { username, actorUri } = Helpers.genSplitDomain();
		const domain = new URL(actorUri).hostname;
		Helpers.seedSameDomainWebfinger(domain, username, actorUri);
		Helpers.seedActor(actorUri, { preferredUsername: username });
		const result = await activitypub.actors.assert([actorUri]);
		assert.ok(Array.isArray(result));
		assert.equal(result.length, 1);
	});

	it('rejects split-domain actor when config is off', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		Helpers.seedActor(actorUri, { preferredUsername: username });
		nconf.set('activitypubAllowSplitDomain', 0);
		const result = await activitypub.actors.assert([actorUri]);
		assert.equal(result, false);
	});
});

// ============================================================================

describe('Mocks.profile canonical handle', () => {
	beforeEach(Helpers.reset);

	it('uses canonical domain when _canonicalHandle is set', async () => {
		const { domainA, username, actorUri } = Helpers.genSplitDomain();
		const actor = Helpers.seedActor(actorUri, { preferredUsername: username });
		actor._canonicalHandle = `${username}@${domainA}`;
		const profile = await activitypub.mocks.profile([actor]);
		assert.ok(profile[0]);
		assert.equal(profile[0].username, `${username}@${domainA}`);
		assert.equal(profile[0].userslug, `${username}@${domainA}`);
		assert.equal(profile[0].webfinger, `acct:${username}@${domainA}`);
	});

	it('uses actor id domain when _canonicalHandle is not set', async () => {
		const { username, actorUri } = Helpers.genSplitDomain();
		const hostname = new URL(actorUri).hostname;
		const actor = Helpers.seedActor(actorUri, { preferredUsername: username });
		const profile = await activitypub.mocks.profile([actor]);
		assert.ok(profile[0]);
		assert.equal(profile[0].username, `${username}@${hostname}`);
		assert.equal(profile[0].userslug, `${username}@${hostname}`);
		assert.equal(profile[0].webfinger, undefined);
	});
});

// ============================================================================

describe('Mocks.category canonical handle', () => {
	beforeEach(Helpers.reset);

	it('uses canonical domain when _canonicalHandle is set', async () => {
		const { domainA, username, actorUri } = Helpers.genSplitDomain();
		const groupActor = {
			'@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
			id: actorUri, url: actorUri, type: 'Group',
			name: 'Mod Team', preferredUsername: username, summary: 'Moderators',
			publicKey: { id: `${actorUri}#key`, owner: actorUri, publicKeyPem: 'test-key' },
			endpoints: {},
			_canonicalHandle: `${username}@${domainA}`,
		};
		const cats = await activitypub.mocks.category([groupActor]);
		assert.ok(cats[0]);
		assert.equal(cats[0].handle, `${username}@${domainA}`);
		assert.equal(cats[0].slug, `${username}@${domainA}`);
		assert.equal(cats[0].webfinger, `acct:${username}@${domainA}`);
	});

	it('uses actor id domain when _canonicalHandle is not set', async () => {
		const { username, actorUri } = Helpers.genSplitDomain();
		const hostname = new URL(actorUri).hostname;
		const groupActor = {
			'@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
			id: actorUri, url: actorUri, type: 'Group',
			name: 'Staff', preferredUsername: username, summary: 'Admins',
			publicKey: { id: `${actorUri}#key`, owner: actorUri, publicKeyPem: 'test-key' },
			endpoints: {},
		};
		const cats = await activitypub.mocks.category([groupActor]);
		assert.ok(cats[0]);
		assert.equal(cats[0].handle, `${username}@${hostname}`);
		assert.equal(cats[0].slug, `${username}@${hostname}`);
		assert.equal(cats[0].webfinger, undefined);
	});
});

// ============================================================================

describe('Split-Domain: Integration - full flow', () => {
	beforeEach(Helpers.reset);

	it('should pass through split-domain resolve -> verify -> profile', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		Helpers.seedWebfinger(domainA, domainB, username, actorUri);
		const queryResult = await activitypub.helpers.query(`${username}@${domainA}`, { strict: false });
		assert.ok(queryResult);
		assert.equal(queryResult.splitDomain, true);

		const actor = Helpers.seedActor(actorUri, { preferredUsername: username });
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.ok(verdict.ok);
		assert.equal(verdict.splitDomain, true);
		assert.equal(verdict.canonicalHandle, `${username}@${domainA}`);

		actor._canonicalHandle = verdict.canonicalHandle;
		const profile = await activitypub.mocks.profile([actor]);
		assert.equal(profile[0].username, `${username}@${domainA}`);
		assert.equal(profile[0].userslug, `${username}@${domainA}`);
		assert.equal(profile[0].webfinger, `acct:${username}@${domainA}`);
	});
});
