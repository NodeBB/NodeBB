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

function getRequestUrl(req) {
	const relativePath = nconf.get('relative_path') || '';
	let requestPath = req.originalUrl || req.url || req.path || '/';

	if (relativePath && !requestPath.startsWith(relativePath)) {
		requestPath = `${relativePath}${requestPath.startsWith('/') ? '' : '/'}${requestPath}`;
	}

	const origin = nconf.get('url_parsed') ? nconf.get('url_parsed').origin : nconf.get('url');
	return new URL(requestPath, origin).href;
}

async function tryVerifyDraft(req, fetchPublicKeyFn) {
	try {
		if (!req.headers.signature) {
			return false;
		}

		const fullUrl = getRequestUrl(req);
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

		const fullUrl = getRequestUrl(req);
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

		const result = await verifyRFC9421Signature(
			parsed,
			publicKeyPem,
			msg => winston.warn(`[activitypub/signatures] verifyRFC9421Signature error: ${msg}`)
		);

		return !!result;
	} catch (err) {
		winston.debug(`[activitypub/signatures] RFC 9421 verification failed: ${err.message}`);
		return false;
	}
}