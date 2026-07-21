'use strict';

const nconf = require('nconf');
const winston = require('winston');
const { createHash } = require('crypto');
const {
	genDraftSignature,
	genDraftSignatureHeader,
	genDraftSigningString,
	importPrivateKey,
	verifyDraftSignature,
	parseDraftRequest,
	parseRFC9421Request,
	verifyRFC9421Signature,
	parseAndImportPublicKey,
} = require('@misskey-dev/node-http-message-signatures');

const Signatures = module.exports;

// Calculates RFC 9530 Digest header string for request payloads.
Signatures.calculateDigest = (body) => {
	if (!body) return null;
	const bodyData = typeof body === 'string' || Buffer.isBuffer(body) ?
		body :
		JSON.stringify(body);

	const hash = createHash('sha256').update(bodyData).digest('base64');
	return `SHA-256=${hash}`;
};

Signatures.sign = async ({ key, keyId }, url, method = 'GET', digest = null) => {
	const parsedUrl = new URL(url);
	const date = new Date().toUTCString();

	// Headers required for signing
	const headersToSign = {
		date,
		host: parsedUrl.host,
	};

	if (digest) {
		headersToSign.digest = digest;
	}

	try {
		// Import private key
		const privateKey = await importPrivateKey(key, ['sign']);

		// Determine signed headers list
		const signedHeaders = digest ?
			['(request-target)', 'host', 'date', 'digest'] :
			['(request-target)', 'host', 'date'];

		// Build signing string
		const signingString = genDraftSigningString(
			{ method, url: parsedUrl.href, headers: headersToSign },
			signedHeaders,
			{ keyId },
		);

		// Sign
		const signature = await genDraftSignature(privateKey, signingString);

		// Construct signature header
		const signatureHeader = genDraftSignatureHeader(signedHeaders, keyId, signature, getDraftAlgoString(privateKey));

		return {
			date,
			...(digest && { digest }),
			signature: signatureHeader,
		};
	} catch (err) {
		winston.error(`[activitypub/signatures] Sign error: ${err.message}`);
		throw err;
	}
};

function getDraftAlgoString(key) {
	const { name } = key.algorithm;
	if (name === 'RSA') {
		return 'rsa-sha256';
	}
	if (name === 'EC') {
		return 'ecdsa-p256-sha256';
	}
	return 'rsa-sha256';
}

Signatures.verify = async (req, fetchPublicKeyFn) => {
	try {
		const { headers } = req;

		// Check if signature header exists (either RFC 9421 or draft format)
		const hasSignature = headers.hasOwnProperty('signature') || headers.hasOwnProperty('signature-input');
		if (!hasSignature) {
			return false;
		}

		// Digest check for requests with body (POST/PUT)
		if (headers.digest) {
			const bodyData = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
			if (!bodyData) return false;

			const computedDigest = Signatures.calculateDigest(bodyData);
			if (headers.digest !== computedDigest) {
				winston.warn('[activitypub/signatures] Digest mismatch during request verification');
				return false;
			}
		}

		const rfcVerified = await tryVerifyRFC9421(req, fetchPublicKeyFn);
		if (rfcVerified) {
			return true;
		}

		const draftVerified = await tryVerifyDraft(req, fetchPublicKeyFn);
		if (draftVerified) {
			return true;
		}

		return false;
	} catch (err) {
		winston.warn(`[activitypub/signatures] Verification failed: ${err.message}`);
		return false;
	}
};

async function tryVerifyDraft(req, fetchPublicKeyFn) {
	try {
		if (!req.headers.signature) {
			return false;
		}

		// Build absolute URL required by the library parser
		const fullUrl = new URL(req.originalUrl || req.url, nconf.get('url')).href;
		const requestObj = {
			method: req.method,
			url: fullUrl,
			headers: req.headers,
		};

		// Parse the draft request
		const parsed = parseDraftRequest(requestObj);
		if (!parsed || !parsed.value || !parsed.value.keyId) {
			return false;
		}

		// Fetch public key PEM
		const publicKeyPem = await fetchPublicKeyFn(parsed.value.keyId, req.ip);
		if (!publicKeyPem) {
			throw new Error(`Public key not found for keyId: ${parsed.value.keyId}`);
		}

		// Pass parsed.value, the public key, and winston as the errorLogger
		const result = await verifyDraftSignature(
			parsed.value,
			publicKeyPem,
			msg => winston.warn(`[activitypub/signatures] verifyDraftSignature error: ${msg}`)
		);

		return !!result;
	} catch (err) {
		winston.debug(`[activitypub/signatures] Draft verification failed: ${err.message}`);
		return false;
	}
}

async function tryVerifyRFC9421(req, fetchPublicKeyFn) {
	try {
		if (!req.headers['signature-input'] || !req.headers.signature) {
			return false;
		}

		// Build absolute URL required by the library parser
		const fullUrl = new URL(req.originalUrl || req.url, nconf.get('url')).href;
		const requestObj = {
			method: req.method,
			url: fullUrl,
			headers: req.headers,
		};

		// Parse RFC 9421 request signature
		const parsed = parseRFC9421Request(requestObj);
		const keyId = parsed?.value?.keyId || parsed?.keyId;

		if (!parsed || !keyId) {
			return false;
		}

		// Fetch public key PEM
		const publicKeyPem = await fetchPublicKeyFn(keyId, req.ip);
		if (!publicKeyPem) {
			throw new Error(`Public key not found for keyId: ${keyId}`);
		}

		// Import public key into CryptoKey format required by library
		const publicKey = await parseAndImportPublicKey(publicKeyPem);

		// Pass the top-level `parsed` object to verifyRFC9421Signature
		const result = await verifyRFC9421Signature(parsed, publicKey);

		return !!result;
	} catch (err) {
		winston.debug(`[activitypub/signatures] RFC 9421 verification failed: ${err.message}`);
		return false;
	}
}