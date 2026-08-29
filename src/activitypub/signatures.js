'use strict';

const nconf = require('nconf');
const winston = require('winston');
const { createHash } = require('crypto');
const {
	genDraftSignature,
	genDraftSignatureHeader,
	genDraftSigningString,
	importPrivateKey,
	importPublicKey,
	verifyDraftSignature,
	parseDraftRequest,
	RFC9421SignatureBaseFactory,
	getWebcrypto,
} = require('@misskey-dev/node-http-message-signatures');

const Signatures = module.exports;

// Clock skew tolerance for RFC 9421 created/expires parameters (seconds)
const RFC9421_CLOCK_SKEW = 300;

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

Signatures.signRfc9421 = async ({ key, keyId }, url, method = 'GET', digest = null) => {
	const parsedUrl = new URL(url);
	const date = new Date().toUTCString();
	const created = Math.floor(Date.now() / 1000);

	// Headers required for signing
	const headersToSign = {
		date,
		host: parsedUrl.host,
	};

	if (digest) {
		headersToSign.digest = digest;
	}

	// Determine signed components list
	// @method + @target-uri (not @request-target) so that verifiers requiring
	// those components explicitly (e.g. Mitra) can validate the signature
	const components = ['@method', '@target-uri', 'host', 'date'];
	if (digest) {
		components.push('digest');
	}

	// Build Signature-Input header
	const signatureInput = `sig1=("${components.join('" "')}");created=${created};keyid="${keyId}"`;
	headersToSign['signature-input'] = signatureInput;

	try {
		// Import private key
		const privateKey = await importPrivateKey(key, ['sign']);

		// Build signature base
		const base = new RFC9421SignatureBaseFactory({
			method,
			url: parsedUrl.href,
			headers: headersToSign,
		});
		const signatureBase = base.generate('sig1');

		// Sign
		const signatureBuffer = await (await getWebcrypto()).subtle.sign(
			getKeyAlgorithm(privateKey),
			privateKey,
			new TextEncoder().encode(signatureBase),
		);

		const signature = Buffer.from(signatureBuffer).toString('base64');

		return {
			date,
			...(digest && { digest }),
			'signature-input': signatureInput,
			// RFC 9421 2.3: the Signature value is a structured-field byte
			// sequence (":base64:" per RFC 8941/9651)
			signature: `sig1=:${signature}:`,
		};
	} catch (err) {
		winston.error(`[activitypub/signatures] Sign (RFC 9421) error: ${err.message}`);
		throw err;
	}
};

function getKeyAlgorithm(key) {
	const { name, namedCurve } = key.algorithm;
	if (name === 'RSASSA-PKCS1-v1_5' || name === 'RSA') {
		return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
	}
	if (name === 'ECDSA' || name === 'EC') {
		return { name: 'ECDSA', hash: 'SHA-256', namedCurve };
	}
	if (name === 'Ed25519' || name === 'Ed448') {
		return { name };
	}
	throw new Error(`Unsupported key algorithm: ${name}`);
}

function getDraftAlgoString(key) {
	const { name } = key.algorithm;
	if (name === 'RSASSA-PKCS1-v1_5' || name === 'RSA') {
		return 'rsa-sha256';
	}
	if (name === 'ECDSA' || name === 'EC') {
		return 'ecdsa-p256-sha256';
	}
	if (name === 'Ed25519' || name === 'Ed448') {
		return 'ed25519-sha512';
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

		const hasBody = req.rawBody || req.body;
		if (hasBody && !headers.digest) {
			winston.warn('[activitypub/signatures] Digest header required for requests with a body');
			return false;
		}

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

// Extracts the key identifier from request signature headers.
// Supports both the draft `keyId` parameter (last occurrence wins, matching
// the draft parser) and the RFC 9421 `keyid` parameter in Signature-Input.
Signatures.getKeyId = (headers) => {
	if (headers['signature-input']) {
		const match = String(headers['signature-input']).match(/keyid\s*=\s*"((?:[^"\\]|\\.)*)"/i);
		if (match) {
			return match[1];
		}
	}

	if (headers.signature) {
		const segments = String(headers.signature).split(',');
		for (let i = segments.length - 1; i >= 0; i--) {
			const match = segments[i].match(/^\s*keyId\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/i);
			if (match) {
				return match[1];
			}
		}
	}

	return null;
};

function getRequestUrl(req, { useHostHeader = false } = {}) {
	const relativePath = nconf.get('relative_path') || '';
	let requestPath = req.originalUrl || req.url || req.path || '/';

	if (relativePath && !requestPath.startsWith(relativePath)) {
		requestPath = `${relativePath}${requestPath.startsWith('/') ? '' : '/'}${requestPath}`;
	}

	let origin = nconf.get('url_parsed') ? nconf.get('url_parsed').origin : nconf.get('url');
	// RFC 9421: reconstruct the target URI from the request itself (scheme +
	// Host header + request-target). Prefer the Host header so verification
	// also succeeds when the dialed host differs from the configured URL
	// (reverse proxies, www vs non-www, port changes)
	if (useHostHeader && req.headers && req.headers.host) {
		const { protocol } = nconf.get('url_parsed') || { protocol: 'https:' };
		origin = `${protocol}//${req.headers.host}`;
	}

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

		if (req.headers.digest) {
			const signedHeaders = (parsed.value.params?.headers ?? [])
				.map(h => h.toLowerCase());
			if (!signedHeaders.includes('digest')) {
				winston.warn('[activitypub/signatures] Digest header present but not included in signed headers (draft)');
				return false;
			}
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

		const fullUrl = getRequestUrl(req, { useHostHeader: true });
		const requestObj = {
			method: req.method,
			url: fullUrl,
			headers: req.headers,
		};

		// The base factory parses the Signature-Input structured field (a
		// dictionary of label → [component list, parameters]) on construction
		const base = new RFC9421SignatureBaseFactory(requestObj);
		const signatures = parseSignatureHeader(req.headers.signature);
		if (!signatures.size) {
			return false;
		}


		const now = Math.floor(Date.now() / 1000);

		// Verify each labeled signature — any one verifying is sufficient
		for (const [label, [components, params = new Map()]] of base.requestSignatureInput) {
			// Parameter values are stored bare (no nested params for sig parameters)
			const keyid = params.get('keyid');
			if (typeof keyid !== 'string' || !keyid) {
				continue;
			}

			// RFC 9421 2.6.1: check created/expires within clock skew
			const created = params.get('created');
			if (typeof created === 'number' && (Math.abs(now - created) > RFC9421_CLOCK_SKEW)) {
				continue;
			}
			const expires = params.get('expires');
			if (typeof expires === 'number' && (expires + RFC9421_CLOCK_SKEW < now)) {
				continue;
			}

			// When Digest header is present, it must be covered by the signature.
			// In RFC 9421 the signed components are the first element of the value array.
			if (req.headers.digest) {
				const signedHeaders = components.map(([name]) => name.toLowerCase());
				if (!signedHeaders.includes('digest')) {
					continue; // this signature doesn't cover the digest; try the next one
				}
			}

			const signature = signatures.get(label);
			if (!signature) {
				continue;
			}

			// Fetch public key PEM
			// eslint-disable-next-line no-await-in-loop
			const publicKeyPem = await fetchPublicKeyFn(keyid, req.ip);
			if (!publicKeyPem) {
				throw new Error(`Public key not found for keyId: ${keyid}`);
			}

			// eslint-disable-next-line no-await-in-loop
			const verified = await verifySignatureValue({
				signatureBase: base.generate(label),
				signature,
				publicKeyPem,
			});
			if (verified) {
				return true;
			}
		}

		return false;
	} catch (err) {
		winston.debug(`[activitypub/signatures] RFC 9421 verification failed: ${err.message}`);
		return false;
	}
}

// Verifies an RFC 9421 signature value against a signature base using WebCrypto
async function verifySignatureValue({ signatureBase, signature, publicKeyPem }) {
	const publicKey = await importPublicKey(publicKeyPem, ['verify']);
	const webcrypto = await getWebcrypto();
	return await webcrypto.subtle.verify(
		getKeyAlgorithm(publicKey),
		publicKey,
		Buffer.from(signature, 'base64'),
		new TextEncoder().encode(signatureBase),
	);
}

// Parses the Signature header (an RFC 8941 dictionary of label → base64 value)
// into a Map of label → signature value
function parseSignatureHeader(headerValue) {
	const signatures = new Map();
	for (const member of String(headerValue).split(',')) {
		const eq = member.indexOf('=');
		if (eq <= 0) {
			continue;
		}
		const label = member.slice(0, eq).trim();
		let value = member.slice(eq + 1).trim();
		// RFC 8941/9651 byte sequence (colon-delimited base64) — the format RFC 9421 senders use
		if (value.startsWith(':') && value.endsWith(':') && value.length > 2) {
			value = value.slice(1, -1);
		} else if (value.startsWith('"')) {
			const end = value.indexOf('"', 1);
			if (end === -1) {
				continue;
			}
			value = value.slice(1, end);
		}
		if (!/^[0-9A-Za-z+/]*={0,2}$/.test(value)) {
			continue;
		}
		signatures.set(label, value);
	}
	return signatures;
}
