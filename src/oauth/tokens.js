'use strict';

const crypto = require('crypto');

const db = require('../database');
const api = require('../api');
const meta = require('../meta');

const tokens = module.exports;

const DEFAULT_TTLS = {
	code: 10 * 60 * 1000, // 10 minutes
	accessToken: 60 * 60 * 1000, // 1 hour
	refreshToken: 30 * 24 * 60 * 60 * 1000, // 30 days
};

tokens.getTTL = async (name) => {
	const settings = await meta.settings.get('core.oauth');
	const ttl = settings && settings[`${name}TTL`];
	return (ttl !== undefined && ttl !== null && ttl !== '' && !isNaN(ttl) && parseInt(ttl, 10) > 0) ?
		parseInt(ttl, 10) :
		DEFAULT_TTLS[name];
};

// ---------------------------------------------------------------------------
// PKCE (RFC 7636)
// ---------------------------------------------------------------------------

tokens.pkce = {};

/**
 * Verifies a PKCE code verifier against the challenge recorded with the
 * authorization code, using the method that was registered with it.
 * The challenge is compared with a constant-time comparison.
 */
tokens.pkce.verify = (codeChallenge, codeVerifier, codeChallengeMethod) => {
	if (typeof codeChallenge !== 'string' || !codeChallenge) {
		return false;
	}
	if (typeof codeVerifier !== 'string' || !codeVerifier) {
		return false;
	}

	let computed;
	if (codeChallengeMethod === 'plain') {
		// Only accepted for codes issued with `plain` recorded (see
		// oauth.validateAuthorizationRequest, which rejects plain for new
		// requests). Kept here so that stored challenges are honoured as recorded.
		computed = codeVerifier;
	} else {
		computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
	}

	if (computed.length !== codeChallenge.length) {
		return false;
	}
	return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(codeChallenge));
};

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

tokens.issueCode = async ({ clientId, uid, redirectUri, scopes, codeChallenge, codeChallengeMethod }) => {
	const code = crypto.randomBytes(24).toString('base64url');
	const codeTTL = await tokens.getTTL('code');
	const createdAt = Date.now();

	await Promise.all([
		db.setObject(`oauth:code:${code}`, {
			clientId,
			uid: String(uid),
			redirectUri,
			scopes: JSON.stringify(scopes || []),
			codeChallenge: codeChallenge || '',
			codeChallengeMethod: codeChallengeMethod || '',
			createdAt: String(createdAt),
			expires: String(createdAt + codeTTL),
		}),
		db.expire(`oauth:code:${code}`, codeTTL),
	]);

	return code;
};

tokens.getCode = async (code) => {
	const raw = await db.getObject(`oauth:code:${code}`);
	if (!raw) {
		return null;
	}
	const expires = parseInt(raw.expires, 10);
	if (expires < Date.now()) {
		await db.delete(`oauth:code:${code}`);
		return null;
	}
	return {
		code,
		clientId: raw.clientId,
		uid: parseInt(raw.uid, 10),
		redirectUri: raw.redirectUri,
		scopes: JSON.parse(raw.scopes || '[]'),
		codeChallenge: raw.codeChallenge || null,
		codeChallengeMethod: raw.codeChallengeMethod || null,
		createdAt: parseInt(raw.createdAt, 10),
		expires,
	};
};

/**
 * Redeem an authorization code (single-use). Returns the code object on
 * success, or null if the code is invalid, expired, or does not match the
 * presented client / redirect URI / PKCE verifier.
 */
tokens.redeemCode = async (code, { clientId, redirectUri, codeVerifier }) => {
	const codeObj = await tokens.getCode(code);
	if (!codeObj) {
		return null;
	}
	if (codeObj.clientId !== clientId) {
		return null;
	}
	if (codeObj.redirectUri && codeObj.redirectUri !== redirectUri) {
		return null;
	}
	// PKCE: if a challenge was recorded, the verifier must match it
	if (codeObj.codeChallenge) {
		if (!codeVerifier || !tokens.pkce.verify(codeObj.codeChallenge, codeVerifier, codeObj.codeChallengeMethod)) {
			return null;
		}
	}

	await db.delete(`oauth:code:${code}`);
	return codeObj;
};

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------

/**
 * Issue an opaque access token. OAuth access tokens live in the same
 * `token:<token>` store as regular API tokens, so the existing Bearer
 * authentication path (`core.api` passport strategy) picks them up
 * transparently.
 */
tokens.issueAccessToken = async ({ clientId, uid, scopes }) => {
	const accessTokenTTL = await tokens.getTTL('accessToken');
	const token = crypto.randomUUID();

	await api.utils.tokens.add({
		token,
		uid,
		description: `oauth:${clientId}`,
		extra: {
			type: 'oauth',
			clientId,
			scopes: JSON.stringify(scopes || []),
			expires: String(Date.now() + accessTokenTTL),
		},
	});
	await db.sortedSetAdd(`oauth:tokens:client:${clientId}`, Date.now(), token);

	return { token, expires: Date.now() + accessTokenTTL };
};

tokens.revokeAccessToken = async (token) => {
	const tokenObj = await api.utils.tokens.get(token);
	if (!tokenObj) {
		return false;
	}
	await api.utils.tokens.delete(token);
	if (tokenObj.clientId) {
		await db.sortedSetRemove(`oauth:tokens:client:${tokenObj.clientId}`, token);
	}
	return true;
};

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

tokens.issueRefreshToken = async ({ clientId, uid, scopes }) => {
	const refreshTokenTTL = await tokens.getTTL('refreshToken');
	const token = crypto.randomBytes(24).toString('base64url');
	const createdAt = Date.now();

	await Promise.all([
		db.setObject(`oauth:refresh:${token}`, {
			clientId,
			uid: String(uid),
			scopes: JSON.stringify(scopes || []),
			createdAt: String(createdAt),
			expires: String(createdAt + refreshTokenTTL),
		}),
		db.expire(`oauth:refresh:${token}`, refreshTokenTTL),
		db.sortedSetAdd(`oauth:refresh:client:${clientId}`, createdAt, token),
	]);

	return { token, expires: createdAt + refreshTokenTTL };
};

tokens.getRefreshToken = async (token) => {
	const raw = await db.getObject(`oauth:refresh:${token}`);
	if (!raw) {
		return null;
	}
	const expires = parseInt(raw.expires, 10);
	if (expires < Date.now()) {
		await tokens.revokeRefreshToken(token);
		return null;
	}
	return {
		token,
		clientId: raw.clientId,
		uid: parseInt(raw.uid, 10),
		scopes: JSON.parse(raw.scopes || '[]'),
		createdAt: parseInt(raw.createdAt, 10),
		expires,
	};
};

tokens.revokeRefreshToken = async (token) => {
	const raw = await db.getObject(`oauth:refresh:${token}`);
	if (!raw) {
		return false;
	}
	await Promise.all([
		db.delete(`oauth:refresh:${token}`),
		db.sortedSetRemove(`oauth:refresh:client:${raw.clientId}`, token),
	]);
	return true;
};

// ---------------------------------------------------------------------------
// Bulk revocation
// ---------------------------------------------------------------------------

tokens.revokeAllForClient = async (clientId) => {
	const [accessTokens, refreshTokens] = await Promise.all([
		db.getSortedSetRange(`oauth:tokens:client:${clientId}`, 0, -1),
		db.getSortedSetRange(`oauth:refresh:client:${clientId}`, 0, -1),
	]);
	await Promise.all([
		...accessTokens.map(t => api.utils.tokens.delete(t)),
		...refreshTokens.map(t => db.delete(`oauth:refresh:${t}`)),
		db.delete(`oauth:tokens:client:${clientId}`),
		db.delete(`oauth:refresh:client:${clientId}`),
	]);
};
