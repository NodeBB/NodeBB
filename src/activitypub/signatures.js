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

		// 1. Check if signature header exists (either RFC 9421 or draft format)
		const hasSignature = headers.hasOwnProperty('signature') || headers.hasOwnProperty('signature-input');
		if (!hasSignature) {
			return false;
		}

		// 2. Digest check for requests with body (POST/PUT)
		if (headers.digest) {
			const bodyData = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
			if (!bodyData) return false;

			const computedDigest = Signatures.calculateDigest(bodyData);
			if (headers.digest !== computedDigest) {
				winston.warn('[activitypub/signatures] Digest mismatch during request verification');
				return false;
			}
		}

		// 3. Try draft signature verification first (legacy Cavage/hs2019)
		const draftVerified = await tryVerifyDraft(req, fetchPublicKeyFn);
		if (draftVerified) {
			return true;
		}

		// 4. Try RFC 9421 signature verification
		const rfcVerified = await tryVerifyRFC9421(req, fetchPublicKeyFn);
		if (rfcVerified) {
			return true;
		}

		// Neither verification method succeeded
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

		// Import public key into CryptoKey format required by library
		const publicKey = await parseAndImportPublicKey(publicKeyPem);

		// Verify signature using imported public key object
		const result = await verifyDraftSignature(parsed.value, publicKey);

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
		if (!parsed || !parsed.value || !parsed.value.keyId) {
			return false;
		}

		// Fetch public key PEM
		const publicKeyPem = await fetchPublicKeyFn(parsed.value.keyId, req.ip);
		if (!publicKeyPem) {
			throw new Error(`Public key not found for keyId: ${parsed.value.keyId}`);
		}

		// Import public key into CryptoKey format required by library
		const publicKey = await parseAndImportPublicKey(publicKeyPem);

		// Verify RFC 9421 signature using imported public key object
		const result = await verifyRFC9421Signature(parsed.value, publicKey);

		return !!result;
	} catch (err) {
		winston.debug(`[activitypub/signatures] RFC 9421 verification failed: ${err.message}`);
		return false;
	}
}