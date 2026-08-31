'use strict';

const assert = require('assert');
const nconf = require('nconf');
const meta = require('../../src/meta');
const utils = require('../../src/utils');
const request = require('../../src/request');
const db = require('../../src/database');

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
	activitypub.helpers._failedWebfingerQueryCache.reset();
	nconf.set('activitypubAllowSplitDomain', 1);
	meta.config.activitypubAllowSplitDomain = 1;
	nconf.set('activitypubAllowLoopback', 0);
	meta.config.activitypubAllowLoopback = 0;
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

	it('accepts same-domain legacy actors via self-link fallback (upgrade to split-domain)', async () => {
		const { domainB, username, actorUri } = Helpers.genSplitDomain();
		// Seed actor with a link array containing rel=self (simulates real AP actor docs)
		const actor = Helpers.seedActor(actorUri, { preferredUsername: username, link: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }] });
		// allowSelfLinkFallback: true simulates an actor with a persisted record
		// (first-time assertions require a live webfinger backref, audit F-4)
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`), { allowSelfLinkFallback: true });
		assert.ok(verdict);
		assert.ok(verdict.ok);
		assert.equal(verdict.canonicalHandle, `${username}@${domainB}`);
		assert.equal(verdict.splitDomain, false);
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
		meta.config.activitypubAllowSplitDomain = 0;
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
		const origCheck = activitypub.blocklists.check;
		activitypub.blocklists.check = async (domain) => {
			if (domain === domainA) {
				return { allowed: false, severity: 'filter', listUrl: 'https://bad.example' };
			}
			return origCheck.call(activitypub.blocklists, domain);
		};
		const verdict = await activitypub.helpers.verifyActorWebfinger(
			actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'canonical-blocked');
		activitypub.blocklists.check = origCheck;
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
		const orig = meta.config.activitypubAllowSplitDomain;
		meta.config.activitypubAllowSplitDomain = 0;
		const result = await activitypub.actors.assert([actorUri]);
		meta.config.activitypubAllowSplitDomain = orig;
		assert.equal(result.length, 0);
	});

	it('upgrades same-domain legacy actors via self-link fallback', async () => {
		const { domainB, username, actorUri } = Helpers.genSplitDomain();
		// Seed actor with link array (rel=self) — simulates real AP actor doc
		Helpers.seedActor(actorUri, { preferredUsername: username, link: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }] });
		// Persisted record — the actor was asserted before webfinger verification
		// existed, so the self-attested fallback is allowed (audit F-4)
		await db.setObject(`userRemote:${actorUri}`, { username: 'legacy_actor' });
		const result = await activitypub.actors.assert([actorUri]);
		assert.ok(Array.isArray(result));
		assert.equal(result.length, 1);
		assert.equal(result[0]._canonicalHandle, `${username}@${domainB}`);
		// Verify profile uses canonical handle
		const profile = await activitypub.mocks.profile(result);
		assert.equal(profile[0].username, `${username}@${domainB}`);
		assert.equal(profile[0].webfinger, undefined); // same-domain → undefined
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
		const queryResult = await activitypub.helpers.query(`${username}@${domainB}`, { strict: false });
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

// ============================================================================

describe('WebFinger cache poisoning (audit F-1)', () => {
	let originalGet;

	beforeEach(Helpers.reset);

	afterEach(() => {
		if (originalGet) {
			request.get = originalGet;
			originalGet = null;
		}
	});

	it('a rejected split-domain backref must not seed an alias entry for the claimed handle', async () => {
		const attacker = Helpers.genSplitDomain();
		const victim = Helpers.genSplitDomain();
		const attackerUri = `https://${attacker.domainB}/uid/${attacker.username}`;
		const victimUri = `https://${victim.domainA}/uid/${victim.username}`;
		const attackerActor = Helpers.seedActor(attackerUri, { preferredUsername: attacker.username });
		const victimActor = Helpers.seedActor(victimUri, { preferredUsername: victim.username });

		// domain B (attacker-controlled) WebFinger claims the victim's domain-A
		// handle; domain A (honest) only serves the victim's own record
		originalGet = request.get;
		request.get = async (url) => {
			const u = new URL(url);
			if (u.host === attacker.domainB) {
				return {
					body: {
						subject: `acct:${victim.username}@${victim.domainA}`,
						links: [{ rel: 'self', type: 'application/activity+json', href: attackerUri }],
						publicKey: null,
					},
					response: { statusCode: 200, headers: { 'content-type': 'application/jrd+json' } },
				};
			}
			if (u.host === victim.domainA) {
				const resource = new URLSearchParams(u.search.slice(1)).get('resource') || '';
				if (resource === `acct:${victim.username}@${victim.domainA}`) {
					return {
						body: {
							subject: `acct:${victim.username}@${victim.domainA}`,
							links: [{ rel: 'self', type: 'application/activity+json', href: victimUri }],
							publicKey: null,
						},
						response: { statusCode: 200, headers: { 'content-type': 'application/jrd+json' } },
					};
				}
			}
			return {
				body: {},
				response: { statusCode: 404, headers: { 'content-type': 'application/jrd+json' } },
			};
		};

		// 1. Attacker's actor: domain B's record is about the victim's account,
		//    not the queried one → rejected by the subject-user guard
		const verdict = await activitypub.helpers.verifyActorWebfinger(attackerUri, attackerActor);
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'subject-mismatch');

		// 2. The claimed handle must not exist in the webfinger cache (alias write removed)
		assert.equal(activitypub.helpers._webfingerCache.get(`${victim.username}@${victim.domainA}`), undefined);

		// 3. Victim's actor asserted by URI (the inbox path): backref reaches
		//    domain A and verification succeeds
		const victimVerdict = await activitypub.helpers.verifyActorWebfinger(victimUri, victimActor);
		assert.ok(victimVerdict);
		assert.equal(victimVerdict.ok, true);
		assert.equal(victimVerdict.splitDomain, false);
		assert.equal(victimVerdict.canonicalHandle, `${victim.username}@${victim.domainA}`);
	});

	it('does not serve a foreign-domain cache entry for a queried handle (hostname guard)', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		const victimUri = `https://${domainA}/uid/${username}`;
		const victimActor = Helpers.seedActor(victimUri, { preferredUsername: username });

		// Simulate a legacy poisoned alias entry: key is the domain-A handle, but
		// the payload was fetched from domain B
		activitypub.helpers._webfingerCache.set(`${username}@${domainA}`, {
			actorUri, username, hostname: domainB,
			subject: `acct:${username}@${domainA}`, splitDomain: true, subjectHostname: domainA,
			_raw: {
				links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
				publicKey: null, subject: `acct:${username}@${domainA}`,
			},
		});

		originalGet = request.get;
		request.get = async (url) => {
			const u = new URL(url);
			if (u.host === domainA) {
				return {
					body: {
						subject: `acct:${username}@${domainA}`,
						links: [{ rel: 'self', type: 'application/activity+json', href: victimUri }],
						publicKey: null,
					},
					response: { statusCode: 200, headers: { 'content-type': 'application/jrd+json' } },
				};
			}
			return {
				body: {},
				response: { statusCode: 404, headers: { 'content-type': 'application/jrd+json' } },
			};
		};

		// Despite the poisoned entry, verification must consult domain A itself
		const verdict = await activitypub.helpers.verifyActorWebfinger(victimUri, victimActor);
		assert.ok(verdict);
		assert.equal(verdict.ok, true);
		assert.equal(verdict.splitDomain, false);
		assert.equal(verdict.canonicalHandle, `${username}@${domainA}`);
	});

	it('rejects backref records served for a different account (subject-user guard)', async () => {
		const { domainB, username, actorUri } = Helpers.genSplitDomain();
		const otherUser = `other_${username}`;

		// domain B's WebFinger for `username` returns a record about `otherUser`
		activitypub.helpers._webfingerCache.set(`${username}@${domainB}`, {
			actorUri, username, hostname: domainB,
			subject: `acct:${otherUser}@${domainB}`, splitDomain: false, subjectHostname: domainB,
			_raw: {
				links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
				publicKey: null, subject: `acct:${otherUser}@${domainB}`,
			},
		});
		Helpers.seedActor(actorUri, { preferredUsername: username });

		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, activitypub._cache.get(`0;${actorUri}`));
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'subject-mismatch');
	});
});

// ============================================================================

describe('preferredUsername / hostname validation (audit F-2)', () => {
	let originalGet;
	let getCalled;

	beforeEach(Helpers.reset);

	afterEach(() => {
		if (originalGet) {
			request.get = originalGet;
			originalGet = null;
		}
	});

	const spyGet = () => {
		getCalled = 0;
		originalGet = request.get;
		request.get = async () => {
			getCalled += 1;
			return {
				body: {},
				response: { statusCode: 404, headers: { 'content-type': 'application/jrd+json' } },
			};
		};
	};

	it('does not issue a webfinger request for an attacker-shaped preferredUsername', async () => {
		const { actorUri } = Helpers.genSplitDomain();
		// preferredUsername containing @ / port would put attacker-controlled
		// values into the query's hostname slot
		const actor = Helpers.seedActor(actorUri, { preferredUsername: 'x@other.example:8443' });
		spyGet();

		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, actor);
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'no-backreference');
		assert.equal(getCalled, 0);
	});

	it('rejects missing or non-string preferredUsername without a webfinger request', async () => {
		const { actorUri } = Helpers.genSplitDomain();
		const noUsername = Helpers.seedActor(actorUri, { preferredUsername: undefined });
		delete noUsername.preferredUsername;
		const badType = Helpers.seedActor(actorUri, { preferredUsername: 12345 });
		spyGet();

		const verdictA = await activitypub.helpers.verifyActorWebfinger(actorUri, noUsername);
		assert.ok(verdictA);
		assert.equal(verdictA.ok, false);
		assert.equal(verdictA.reason, 'no-backreference');

		const verdictB = await activitypub.helpers.verifyActorWebfinger(actorUri, badType);
		assert.ok(verdictB);
		assert.equal(verdictB.ok, false);
		assert.equal(verdictB.reason, 'no-backreference');
		assert.equal(getCalled, 0);
	});

	it('query() rejects port-bearing and path-bearing hostnames before any request', async () => {
		spyGet();
		const r1 = await activitypub.helpers.query('user@target.example:8443', { strict: false });
		const r2 = await activitypub.helpers.query('user@b/c', { strict: false });
		const r3 = await activitypub.helpers.query('user@space host', { strict: false });
		assert.equal(r1, false);
		assert.equal(r2, false);
		assert.equal(r3, false);
		assert.equal(getCalled, 0);
	});

	it('query() still fetches normally for plain hostnames', async () => {
		const { domainB } = Helpers.genSplitDomain();
		spyGet();
		const result = await activitypub.helpers.query(`user@${domainB}`, { strict: false });
		// mock returns 404 → false, but the request must have been made
		assert.equal(result, false);
		assert.equal(getCalled, 1);
	});
});

// ============================================================================

describe('Split-domain key cross-check (audit F-3)', () => {
	beforeEach(Helpers.reset);

	const seedKeys = (domainA, domainB, username, actorUri, forwardPem) => {
		activitypub.helpers._webfingerCache.set(`${username}@${domainB}`, {
			actorUri, username, hostname: domainB,
			subject: `acct:${username}@${domainA}`, splitDomain: true, subjectHostname: domainA,
			publicKey: forwardPem ? { id: `https://${domainA}/${username}#key`, owner: `acct:${username}@${domainA}`, publicKeyPem: forwardPem } : null,
			_raw: { links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }] },
		});
		activitypub.helpers._webfingerCache.set(`${username}@${domainA}`, {
			actorUri, username, hostname: domainA,
			subject: `acct:${username}@${domainA}`, splitDomain: false, subjectHostname: domainA,
			publicKey: forwardPem ? { id: `https://${domainA}/${username}#key`, owner: `acct:${username}@${domainA}`, publicKeyPem: forwardPem } : null,
			_raw: { links: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }] },
		});
	};

	it('rejects when the forward webfinger key differs from the actor document key', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		seedKeys(domainA, domainB, username, actorUri, 'FORWARD-KEY-PEM');
		const actor = Helpers.seedActor(actorUri, {
			preferredUsername: username,
			publicKey: { id: `${actorUri}#key`, owner: actorUri, publicKeyPem: 'ACTOR-DOC-KEY-PEM' },
		});
		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, actor);
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'key-mismatch');
	});

	it('accepts with keyVerified: true when the keys match', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		seedKeys(domainA, domainB, username, actorUri, 'SAME-KEY-PEM');
		const actor = Helpers.seedActor(actorUri, {
			preferredUsername: username,
			publicKey: { id: `${actorUri}#key`, owner: actorUri, publicKeyPem: 'SAME-KEY-PEM' },
		});
		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, actor);
		assert.ok(verdict);
		assert.equal(verdict.ok, true);
		assert.equal(verdict.reason, 'split-domain');
		assert.equal(verdict.keyVerified, true);
	});

	it('accepts with keyVerified: false when the forward webfinger carries no key', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		seedKeys(domainA, domainB, username, actorUri, null);
		const actor = Helpers.seedActor(actorUri, {
			preferredUsername: username,
			publicKey: { id: `${actorUri}#key`, owner: actorUri, publicKeyPem: 'ACTOR-DOC-KEY-PEM' },
		});
		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, actor);
		assert.ok(verdict);
		assert.equal(verdict.ok, true);
		assert.equal(verdict.keyVerified, false);
	});
});

// ============================================================================

describe('Self-link fallback gating (audit F-4)', () => {
	let originalGet;

	beforeEach(Helpers.reset);

	afterEach(() => {
		if (originalGet) {
			request.get = originalGet;
			originalGet = null;
		}
	});

	const seedSelfLinkedActor = (domainB, username, actorUri) => Helpers.seedActor(actorUri, {
		preferredUsername: username,
		link: [{ rel: 'self', href: actorUri, type: 'application/activity+json' }],
	});

	it('rejects first-time actors with a valid self-link when webfinger is unavailable', async () => {
		const { domainB, username, actorUri } = Helpers.genSplitDomain();
		const actor = seedSelfLinkedActor(domainB, username, actorUri);
		originalGet = request.get;
		request.get = async () => ({
			body: {},
			response: { statusCode: 404, headers: { 'content-type': 'application/jrd+json' } },
		});
		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, actor);
		assert.ok(verdict);
		assert.equal(verdict.ok, false);
		assert.equal(verdict.reason, 'no-backreference');
	});

	it('accepts known actors via self-link fallback when webfinger is unavailable', async () => {
		const { domainB, username, actorUri } = Helpers.genSplitDomain();
		const actor = seedSelfLinkedActor(domainB, username, actorUri);
		originalGet = request.get;
		request.get = async () => ({
			body: {},
			response: { statusCode: 404, headers: { 'content-type': 'application/jrd+json' } },
		});
		const verdict = await activitypub.helpers.verifyActorWebfinger(actorUri, actor, { allowSelfLinkFallback: true });
		assert.ok(verdict);
		assert.equal(verdict.ok, true);
		assert.equal(verdict.splitDomain, false);
		assert.equal(verdict.canonicalHandle, `${username}@${domainB}`);
	});
});

// ============================================================================

describe('Webfinger failure negative cache (audit F-4)', () => {
	let originalGet;
	let getCalled;

	beforeEach(Helpers.reset);

	afterEach(() => {
		if (originalGet) {
			request.get = originalGet;
			originalGet = null;
		}
	});

	it('short-circuits repeated queries after a transport failure', async () => {
		const { domainB } = Helpers.genSplitDomain();
		getCalled = 0;
		originalGet = request.get;
		request.get = async () => {
			getCalled += 1;
			return {
				body: {},
				response: { statusCode: 404, headers: { 'content-type': 'application/jrd+json' } },
			};
		};

		const r1 = await activitypub.helpers.query(`user@${domainB}`, { strict: false });
		assert.equal(r1, false);
		assert.equal(getCalled, 1);

		// Second query within the failure window: no additional network call
		const r2 = await activitypub.helpers.query(`user@${domainB}`, { strict: false });
		assert.equal(r2, false);
		assert.equal(getCalled, 1);
	});

	it('does not negative-cache strict policy rejections of split-domain responses', async () => {
		const { domainA, domainB, username, actorUri } = Helpers.genSplitDomain();
		getCalled = 0;
		originalGet = request.get;
		request.get = async () => {
			getCalled += 1;
			return {
				body: {
					subject: `acct:${username}@${domainA}`,
					links: [{ rel: 'self', type: 'application/activity+json', href: actorUri }],
					publicKey: null,
				},
				response: { statusCode: 200, headers: { 'content-type': 'application/jrd+json' } },
			};
		};

		// Strict query rejects split-domain responses by policy (no cache write)
		const r1 = await activitypub.helpers.query(`${username}@${domainB}`);
		assert.equal(r1, false);
		assert.equal(getCalled, 1);

		// A subsequent non-strict query must still be answered (fresh fetch → payload),
		// not short-circuited by a failure entry
		const r2 = await activitypub.helpers.query(`${username}@${domainB}`, { strict: false });
		assert.ok(r2);
		assert.equal(r2.splitDomain, true);
		assert.equal(getCalled, 2);
	});
});
