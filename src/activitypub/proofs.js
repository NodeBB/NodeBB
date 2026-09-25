'use strict';

// FEP-8b32: Object Integrity Proofs
// https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.md
//
// Self-authenticating objects via W3C Data Integrity (eddsa-jcs-2022 cryptosuite:
// JCS canonicalization, SHA-256, EdDSA). Proofs are computed at serialization
// time and never stored. The W3C reference implementation is ESM-only, so it is
// loaded lazily via dynamic import().

const crypto = require('crypto');
const nconf = require('nconf');
const winston = require('winston');
const base58 = require('base58-universal');

const db = require('../database');
const request = require('../request');
const ttl = require('../cache/ttl');

const activitypub = module.parent.exports;
const Proofs = module.exports;

// multibase base58btc header + multicodec varint headers (ed25519-pub / ed25519-priv)
const MULTIBASE_HEADER = 'z';
const MULTICODEC_PUB_HEADER = new Uint8Array([0xed, 0x01]);
const MULTICODEC_PRIV_HEADER = new Uint8Array([0x80, 0x26]);

// FEP-8b32: the (only) cryptosuite this implementation generates and verifies.
Proofs.CRYPTOSUITE = 'eddsa-jcs-2022';

// JSON-LD contexts and key documents are fetched during proof verification;
// cache them so repeated verifications don't hammer the network.
const documentCache = ttl({
	name: 'ap-proof-document-cache',
	max: 1000,
	ttl: 1000 * 60 * 60, // 1 hour
});

Proofs._cache = documentCache; // exported for tests

let diModules;
async function getModules() {
	if (!diModules) {
		const [
			{ DataIntegrityProof },
			{ createSignCryptosuite, createVerifyCryptosuite },
			Ed25519Multikey,
			{ default: jsigs },
		] = await Promise.all([
			import('@digitalbazaar/data-integrity'),
			import('@digitalbazaar/eddsa-jcs-2022-cryptosuite'),
			import('@digitalbazaar/ed25519-multikey'),
			import('jsonld-signatures'),
		]);
		diModules = { DataIntegrityProof, createSignCryptosuite, createVerifyCryptosuite, Ed25519Multikey, jsigs };
	}
	return diModules;
}

Proofs._documentLoader = async (url) => {
	const cached = documentCache.get(url);
	if (cached) {
		return { documentUrl: url, document: cached };
	}

	const { body } = await request.get(url, {
		timeout: 5000,
		sizeLimit: 1024 * 1024,
		headers: {
			accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
		},
		redirect: 'follow',
	});
	documentCache.set(url, body);
	return { documentUrl: url, document: body };
};

Proofs._keyUrl = (type, id) => {
	if (type === 'uid') {
		return `${nconf.get('url')}${id > 0 ? `/uid/${id}` : '/actor'}/keys/ed25519`;
	}
	return `${nconf.get('url')}${id > 0 ? `/category/${id}` : '/actor'}/keys/ed25519`;
};

Proofs._controllerUrl = (type, id) => {
	if (type === 'uid') {
		return `${nconf.get('url')}${id > 0 ? `/uid/${id}` : '/actor'}`;
	}
	return `${nconf.get('url')}${id > 0 ? `/category/${id}` : '/actor'}`;
};

// `field` selects the JWK member: 'x' (public) for the public key, 'd' (private)
// for the secret. Node's private Ed25519 JWK carries BOTH `d` and `x`, so the
// secret must read `d` explicitly — `jwk.x || jwk.d` would pick the public key.
function jwkToMultibase(jwk, header, field) {
	const raw = Buffer.from(jwk[field], 'base64url');
	return MULTIBASE_HEADER + base58.encode(Buffer.concat([header, raw]));
}

// Generates an Ed25519 key-pair (stored as multibase, per the Multikey spec)
// alongside the existing RSA pair used for HTTP signatures.
Proofs.generateEd25519Keys = async (type, id) => {
	activitypub.helpers.log(`[activitypub/proofs] Generating Ed25519 key-pair for ${type} ${id}`);
	const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
	const pubJwk = publicKey.export({ format: 'jwk' });
	const privJwk = privateKey.export({ format: 'jwk' });

	const keys = {
		publicKeyMultibase: jwkToMultibase(pubJwk, MULTICODEC_PUB_HEADER, 'x'),
		secretKeyMultibase: jwkToMultibase(privJwk, MULTICODEC_PRIV_HEADER, 'd'),
	};
	await db.setObject(`${type}:${id}:keys:ed25519`, keys);
	return keys;
};

// Returns the Multikey key-pair interface plus its keyId/controller URIs.
// Generates the key-pair on first use (same lazy pattern as getPublicKey).
Proofs.getEd25519Key = async (type, id) => {
	if (!['cid', 'uid'].includes(type)) {
		throw new Error('[[error:invalid-data]]');
	}

	let keys;
	try {
		keys = await db.getObject(`${type}:${id}:keys:ed25519`);
	} catch (e) {
		keys = null;
	}
	if (!keys) {
		keys = await Proofs.generateEd25519Keys(type, id);
	}

	const { Ed25519Multikey } = await getModules();
	const keyId = Proofs._keyUrl(type, id);
	const controller = Proofs._controllerUrl(type, id);
	const keyPair = await Ed25519Multikey.from({
		'@context': 'https://w3id.org/security/multikey/v1',
		type: 'Multikey',
		controller,
		id: keyId,
		publicKeyMultibase: keys.publicKeyMultibase,
		secretKeyMultibase: keys.secretKeyMultibase,
	});

	return { keyPair, keyId, controller };
};

// The standalone key document served at /keys/ed25519 (and embedded in
// assertionMethod where convenient).
Proofs.getKeyDocument = async (type, id) => {
	const { keyPair, keyId, controller } = await Proofs.getEd25519Key(type, id);
	const document = await keyPair.export({ publicKey: true, includeContext: true });
	return {
		...document,
		id: keyId,
		controller,
	};
};

// Adds a DataIntegrityProof to the object (FEP-8b32 §Proof generation).
// Objects with fragment identifiers are skipped (FEP: SHOULD NOT be signed).
Proofs.sign = async (object, { type, id, created }) => {
	if (!object || typeof object !== 'object' || !object.id || String(object.id).includes('#')) {
		return object;
	}

	const { keyPair } = await Proofs.getEd25519Key(type, id);
	const { DataIntegrityProof, createSignCryptosuite, jsigs } = await getModules();
	const { purposes: { AssertionProofPurpose } } = jsigs;

	const suite = new DataIntegrityProof({
		signer: keyPair.signer(),
		cryptosuite: createSignCryptosuite(),
		date: created ? new Date(created) : undefined, // proof.created (deterministic when fixed)
	});
	// jsigs.sign mutates its input and appends to any existing proof; sign a
	// clone with pre-existing proofs/signatures removed so the result carries
	// exactly one fresh proof and the caller's object is untouched.
	const clone = structuredClone(object);
	delete clone.proof;
	delete clone.signature;
	const signed = await jsigs.sign(clone, {
		suite,
		purpose: new AssertionProofPurpose(),
		documentLoader: Proofs._documentLoader,
	});

	return signed;
};

// `proof` MAY be a single object or an array (e.g. when an already-signed
// object is re-signed). Returns the first DataIntegrityProof carrying the
// supported cryptosuite, or undefined.
Proofs._selectProof = (object) => {
	if (!object || typeof object !== 'object') {
		return undefined;
	}
	return (Array.isArray(object.proof) ? object.proof : [object.proof])
		.find(p => p && typeof p === 'object' && p.type === 'DataIntegrityProof' && p.cryptosuite === Proofs.CRYPTOSUITE);
};

// True when the object carries a proof this implementation can verify.
// FEP-8b32: proofs with an unsupported cryptosuite SHOULD be ignored and
// other authentication methods (e.g. the HTTP signature) used instead.
Proofs.isSupported = object => Boolean(Proofs._selectProof(object));

// Verifies the object's integrity proof (FEP-8b32 §Proof verification).
// Returns false when there is no (supported) proof or verification fails.
Proofs.verify = async (object) => {
	const candidate = Proofs._selectProof(object);
	if (!candidate) {
		if (object && object.proof) {
			activitypub.helpers.log(`[activitypub/proofs] Unsupported cryptosuite: ${object.proof.cryptosuite}`);
		}
		return false;
	}

	// FEP-8b32: if both proof and signature are present, the linked data
	// signature MUST be removed before verifying the integrity proof. Verify
	// the selected proof in isolation (a single `proof` field).
	// eslint-disable-next-line no-unused-vars
	const { signature, ...document } = object;
	document.proof = candidate;

	try {
		const { DataIntegrityProof, createVerifyCryptosuite, jsigs } = await getModules();
		const { purposes: { AssertionProofPurpose } } = jsigs;
		const suite = new DataIntegrityProof({ cryptosuite: createVerifyCryptosuite() });
		const result = await jsigs.verify(document, {
			suite,
			purpose: new AssertionProofPurpose({ type: 'DataIntegrityProof' }),
			documentLoader: Proofs._documentLoader,
		});
		return result.verified === true;
	} catch (e) {
		winston.warn(`[activitypub/proofs] Verification error: ${e.message}`);
		return false;
	}
};

// Normalizes attributedTo (string | { id }) to a single URL string. Arrays
// (or other shapes) yield undefined so the caller treats the object as
// unauthenticated — a single author is required to bind a proof.
Proofs._normalizeAttributedTo = (attributedTo) => {
	if (typeof attributedTo === 'string') {
		return attributedTo.trim();
	}
	if (attributedTo && typeof attributedTo === 'object' && !Array.isArray(attributedTo) && typeof attributedTo.id === 'string') {
		return attributedTo.id.trim();
	}
	return undefined;
};

// Verifies the object's integrity proof AND binds it to the object's author.
// `verify` alone only confirms the signature is valid against the key at
// proof.verificationMethod — a relay could re-sign tampered content with its
// own key and pass. This additionally requires that key to be controlled by
// the object's attributedTo (the author), so only the author's own proof
// counts as authentic. Returns false when there is no (supported) proof,
// verification fails, the key document is unavailable, or the key's controller
// does not match the author.
Proofs.verifyAuthenticity = async (object) => {
	if (!object || typeof object !== 'object') {
		return false;
	}
	if (!(await Proofs.verify(object))) {
		return false;
	}

	const candidate = Proofs._selectProof(object);
	const attributedTo = Proofs._normalizeAttributedTo(object.attributedTo);
	if (!candidate || !candidate.verificationMethod || !attributedTo) {
		return false;
	}

	try {
		// _documentLoader is cached, so this reuses the key document already
		// fetched during verify() above.
		const { document: keyDoc } = await Proofs._documentLoader(candidate.verificationMethod);
		const controller = keyDoc && keyDoc.controller;
		if (!controller) {
			return false;
		}
		return new URL(controller).href === new URL(attributedTo).href;
	} catch (e) {
		return false;
	}
};

// Removes proof (and legacy linked data signature) without mutating the input.
Proofs.strip = (object) => {
	if (!object || typeof object !== 'object') {
		return object;
	}
	const rest = { ...object };
	delete rest.proof;
	delete rest.signature;
	return rest;
};
