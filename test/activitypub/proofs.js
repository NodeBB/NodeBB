'use strict';

const assert = require('assert');
const { createHash } = require('crypto');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const request = require('../../src/request');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

const proofs = activitypub.proofs;

describe('FEP-8b32: Object Integrity Proofs', () => {
	describe('Key management', () => {
		let uid;

		before(async function () {
			uid = await user.create({ username: utils.generateUUID() });
		});

		it('should generate an Ed25519 key-pair (multibase)', async function () {
			const keys = await proofs.generateEd25519Keys('uid', uid);
			assert.ok(keys.publicKeyMultibase.startsWith('z'));
			assert.ok(keys.secretKeyMultibase.startsWith('z'));

			const stored = await db.getObject(`uid:${uid}:keys:ed25519`);
			assert.strictEqual(stored.publicKeyMultibase, keys.publicKeyMultibase);
			assert.strictEqual(stored.secretKeyMultibase, keys.secretKeyMultibase);
		});

		it('should return the same key-pair on subsequent calls', async function () {
			const { keyPair, keyId, controller } = await proofs.getEd25519Key('uid', uid);
			assert.strictEqual(keyId, `${nconf.get('url')}/uid/${uid}/keys/ed25519`);
			assert.strictEqual(controller, `${nconf.get('url')}/uid/${uid}`);
			assert.ok(keyPair.publicKeyMultibase);

			const again = await proofs.getEd25519Key('uid', uid);
			assert.strictEqual(again.keyPair.publicKeyMultibase, keyPair.publicKeyMultibase);
		});

		it('should produce a Multikey key document', async function () {
			const document = await proofs.getKeyDocument('uid', uid);
			assert.strictEqual(document.id, `${nconf.get('url')}/uid/${uid}/keys/ed25519`);
			assert.strictEqual(document.type, 'Multikey');
			assert.strictEqual(document.controller, `${nconf.get('url')}/uid/${uid}`);
			assert.strictEqual(document['@context'], 'https://w3id.org/security/multikey/v1');
			assert.ok(document.publicKeyMultibase.startsWith('z'));
			assert.strictEqual(document.secretKeyMultibase, undefined);
		});

		it('should use /actor for uid 0', async function () {
			const { keyId, controller } = await proofs.getEd25519Key('uid', 0);
			assert.strictEqual(keyId, `${nconf.get('url')}/actor/keys/ed25519`);
			assert.strictEqual(controller, `${nconf.get('url')}/actor`);
		});
	});

	describe('Sign / verify / strip', () => {
		let uid;
		let keyId;
		let controller;

		before(async function () {
			meta.config.activitypubIntegrityProofs = true;
			uid = await user.create({ username: utils.generateUUID() });
			({ keyId, controller } = await proofs.getEd25519Key('uid', uid));

			// Hermetic verification: pre-populate the document cache with the
			// JSON-LD contexts and local documents (no network in verify path)
			const contexts = [
				'https://www.w3.org/ns/activitystreams',
				'https://w3id.org/security/data-integrity/v1',
				'https://w3id.org/security/multikey/v1',
				'https://www.w3.org/ns/did/v1',
			];
			await Promise.all(contexts.map(async (url) => {
				const { body } = await request.get(url, {
					headers: { accept: 'application/ld+json' },
				});
				proofs._cache.set(url, body);
			}));

			const keyDocument = await proofs.getKeyDocument('uid', uid);
			proofs._cache.set(keyId, keyDocument);

			const actor = await activitypub.mocks.actors.user(uid);
			proofs._cache.set(controller, actor);
		});

		after(function () {
			meta.config.activitypubIntegrityProofs = undefined;
		});

		const note = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: `${nconf.get('url')}/post/1`,
			type: 'Note',
			attributedTo: controller,
			content: 'Hello world',
		};

		it('should add a DataIntegrityProof to a signed object', async function () {
			const signed = await proofs.sign(note, { type: 'uid', id: uid, created: '2025-01-01T00:00:00Z' });
			assert.ok(signed.proof);
			assert.strictEqual(signed.proof.type, 'DataIntegrityProof');
			assert.strictEqual(signed.proof.cryptosuite, 'eddsa-jcs-2022');
			assert.strictEqual(signed.proof.proofPurpose, 'assertionMethod');
			assert.strictEqual(signed.proof.verificationMethod, keyId);
			assert.strictEqual(signed.proof.created, '2025-01-01T00:00:00Z');
			assert.ok(signed.proof.proofValue);
			// original object is not mutated
			assert.strictEqual(note.proof, undefined);
		});

		it('should not sign objects with fragment identifiers', async function () {
			const activity = {
				id: `${nconf.get('url')}/post/1#activity/create/123`,
				type: 'Create',
			};
			const signed = await proofs.sign(activity, { type: 'uid', id: uid });
			assert.strictEqual(signed.proof, undefined);
		});

		it('should be deterministic for a fixed created timestamp', async function () {
			const a = await proofs.sign(note, { type: 'uid', id: uid, created: '2025-01-01T00:00:00Z' });
			const b = await proofs.sign(note, { type: 'uid', id: uid, created: '2025-01-01T00:00:00Z' });
			assert.deepStrictEqual(a.proof, b.proof);
		});

		it('should verify a signed object', async function () {
			const signed = await proofs.sign(note, { type: 'uid', id: uid, created: '2025-01-01T00:00:00Z' });
			assert.strictEqual(await proofs.verify(signed), true);
		});

		it('should reject a tampered object', async function () {
			const signed = await proofs.sign(note, { type: 'uid', id: uid, created: '2025-01-01T00:00:00Z' });
			const tampered = { ...signed, content: 'Hello evil' };
			assert.strictEqual(await proofs.verify(tampered), false);
		});

		it('should return false for objects without a proof', async function () {
			assert.strictEqual(await proofs.verify(note), false);
		});

		it('should ignore unsupported cryptosuites', async function () {
			const signed = await proofs.sign(note, { type: 'uid', id: uid, created: '2025-01-01T00:00:00Z' });
			const foreign = { ...signed, proof: { ...signed.proof, cryptosuite: 'ecdsa-rdfc-2022' } };
			assert.strictEqual(await proofs.verify(foreign), false);
		});

		it('should strip proof and signature without mutating', function () {
			const signed = { ...note, proof: { type: 'DataIntegrityProof' }, signature: { type: 'Ed25519Signature2018' } };
			const stripped = proofs.strip(signed);
			assert.strictEqual(stripped.proof, undefined);
			assert.strictEqual(stripped.signature, undefined);
			assert.strictEqual(signed.proof.type, 'DataIntegrityProof');
			assert.strictEqual(stripped.content, note.content);
		});
	});

	describe('Outbound integration (notes.public)', () => {
		let cid;
		let uid;
		let postData;

		before(async function () {
			this.timeout(20000);
			({ cid } = await categories.create({ name: utils.generateUUID() }));
			uid = await user.create({ username: utils.generateUUID() });
			({ postData } = await topics.post({
				cid,
				uid,
				content: utils.generateUUID(),
			}));
			meta.config.activitypubIntegrityProofs = true;
		});

		after(function () {
			meta.config.activitypubIntegrityProofs = undefined;
		});

		it('should add a verifiable proof to notes.public output', async function () {
			const object = await activitypub.mocks.notes.public(postData);
			assert.ok(object.proof, 'expected a proof on the note');
			assert.strictEqual(object.proof.cryptosuite, 'eddsa-jcs-2022');
			assert.strictEqual(object.proof.verificationMethod, `${nconf.get('url')}/uid/${uid}/keys/ed25519`);

			// Hermetic verification (key + actor documents from the live server)
			const keyDocument = await proofs.getKeyDocument('uid', uid);
			proofs._cache.set(object.proof.verificationMethod, keyDocument);
			const actor = await activitypub.mocks.actors.user(uid);
			proofs._cache.set(`${nconf.get('url')}/uid/${uid}`, actor);

			assert.strictEqual(await proofs.verify(object), true);
		});

		it('should produce byte-identical objects across calls', async function () {
			const a = await activitypub.mocks.notes.public(postData);
			const b = await activitypub.mocks.notes.public(postData);
			assert.deepStrictEqual(a, b);
		});

		it('should omit the proof when the feature is disabled', async function () {
			meta.config.activitypubIntegrityProofs = undefined;
			const object = await activitypub.mocks.notes.public(postData);
			assert.strictEqual(object.proof, undefined);
		});
	});

	describe('Inbox proof authentication (middleware)', () => {
		let cid;
		let uid;
		let postData;

		before(async function () {
			({ cid } = await categories.create({ name: utils.generateUUID() }));
			uid = await user.create({ username: utils.generateUUID() });
			({ postData } = await topics.post({
				cid,
				uid,
				content: utils.generateUUID(),
			}));
			meta.config.activitypubIntegrityProofs = true;
		});

		after(function () {
			meta.config.activitypubIntegrityProofs = undefined;
		});

		const signedCreate = async (tamper) => {
			const note = await activitypub.mocks.notes.public(postData);
			const signed = await proofs.sign(note, { type: 'uid', id: uid, created: note.published });
			if (tamper) {
				signed.content = 'tampered content';
			}
			return {
				id: `${nconf.get('url')}/post/${postData.pid}#activity/create`,
				type: 'Create',
				actor: `${nconf.get('url')}/uid/${uid}`,
				object: signed,
			};
		};

		// POSTs an activity to the local inbox, optionally with an HTTP
		// signature. By default the signature is from the activity's actor
		// (the local user); `signAs` signs with a different user's key.
		const postInbox = async (body, { sign = false, signAs } = {}) => {
			const headers = { 'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"' };
			if (sign) {
				const signerUid = signAs || uid;
				const keyData = await activitypub.getPrivateKey('uid', signerUid);
				const checksum = `SHA-256=${createHash('sha256').update(JSON.stringify(body)).digest('base64')}`;
				Object.assign(headers, await activitypub.sign(keyData, `${nconf.get('url')}/inbox`, checksum));
			}
			return request.post(`${nconf.get('url')}/inbox`, { body, headers });
		};

		it('should require an HTTP signature even when a valid proof is present', async function () {
			const { response } = await postInbox(await signedCreate(false));
			assert.strictEqual(response.statusCode, 401);
		});

		it('should reject a tampered proof even without an HTTP signature', async function () {
			const { response } = await postInbox(await signedCreate(true));
			assert.strictEqual(response.statusCode, 400);
		});

		it('should reject a tampered proof even with a valid HTTP signature', async function () {
			const { response } = await postInbox(await signedCreate(true), { sign: true });
			assert.strictEqual(response.statusCode, 400);
		});

		it('should reject a valid proof when the HTTP signature is invalid', async function () {
			// Sign the activity, then tamper with the envelope (actor). The
			// proof on the object is untouched and still valid, but the
			// signature no longer covers what was sent — the forged-activity
			// attack: wrapping a genuine object in a forged envelope.
			const body = await signedCreate(false);
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const checksum = `SHA-256=${createHash('sha256').update(JSON.stringify(body)).digest('base64')}`;
			const headers = {
				'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				...(await activitypub.sign(keyData, `${nconf.get('url')}/inbox`, checksum)),
			};
			body.actor = `${nconf.get('url')}/uid/999999`;
			const { response } = await request.post(`${nconf.get('url')}/inbox`, { body, headers });
			assert.strictEqual(response.statusCode, 400);
		});

		it('should pass verification with a valid proof and a valid HTTP signature', async function () {
			const { response } = await postInbox(await signedCreate(false), { sign: true });
			// Neither rejected by the proof gate (400) nor by the signature
			// requirement (401). Downstream handling may still reject for
			// unrelated reasons (e.g. key-ownership cross-check for local actors).
			assert.notStrictEqual(response.statusCode, 401);
			assert.notStrictEqual(response.statusCode, 400);
		});
	});

	describe('Actor mocks', () => {
		let uid;

		before(async function () {
			uid = await user.create({ username: utils.generateUUID() });
		});

		it('should expose assertionMethod when enabled', async function () {
			meta.config.activitypubIntegrityProofs = true;
			const actor = await activitypub.mocks.actors.user(uid);
			assert.strictEqual(actor.assertionMethod, `${nconf.get('url')}/uid/${uid}/keys/ed25519`);
			assert.ok(actor['@context'].includes('https://www.w3.org/ns/did/v1'));
		});

		it('should omit assertionMethod when disabled', async function () {
			meta.config.activitypubIntegrityProofs = undefined;
			const actor = await activitypub.mocks.actors.user(uid);
			assert.strictEqual(actor.assertionMethod, undefined);
		});
	});
});
