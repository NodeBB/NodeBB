'use strict';

const nconf = require('nconf');
const winston = require('winston');

const api = require('../api');
const oauth = require('../oauth');
const user = require('../user');
const groups = require('../groups');

const controller = module.exports;

// Parameters a client may pass by reference via request_uri (RFC 9126)
const REQUEST_PARAMS = [
	'client_id',
	'redirect_uri',
	'response_type',
	'scope',
	'state',
	'code_challenge',
	'code_challenge_method',
];

/**
 * RFC 9126: stores an authorization request so a client can reference it with
 * `request_uri` instead of repeating every parameter. Only the parameters a
 * standard authorization request accepts are stored, and only requests for
 * registered clients are accepted.
 */
controller.requests = {
	create: async (req, res) => {
		const source = (req.body || {}).params;
		if (!source || typeof source !== 'object' || Array.isArray(source)) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'params must be an object of authorization request parameters',
			});
		}

		const params = {};
		Object.keys(source).forEach((key) => {
			if (REQUEST_PARAMS.includes(key) && typeof source[key] === 'string' && source[key].trim()) {
				params[key] = source[key].trim();
			}
		});

		if (!params.client_id) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'params.client_id is required',
			});
		}

		const client = await oauth.clients.get(params.client_id);
		if (!client || client.disabled) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'client_id is not a registered client',
			});
		}

		const id = await oauth.requests.create({ params, uid: req.uid });
		res.status(201).json({
			id,
			request_uri: `${nconf.get('url')}${nconf.get('relative_path')}/oauth/params/${id}`,
			expires_in: oauth.requests.TTL,
			params,
		});
	},

	get: async (req, res) => {
		const data = await oauth.requests.get(req.params.id);
		if (!data) {
			return res.status(404).json({
				error: 'invalid_request',
				error_description: 'request_uri not found',
			});
		}

		res.json({ params: data.params });
	},
};

/**
 * Consent screen for the authorization endpoint. Reached after
 * `oauth.server.authorize()` has validated the request and stored the
 * transaction in the session.
 */
controller.authorize = {
	get: async (req, res) => {
		const { client, transactionID, req: areq } = req.oauth2;
		const scopes = (areq.scope || []).map(scope => ({
			name: scope,
			description: oauth.scopes[scope],
		}));

		res.render('oauth/authorize', {
			title: '[[oauth:authorize.title]]',
			client: {
				id: client.id,
				name: client.name,
				description: client.description,
			},
			scopes,
			transactionID,
			redirectURI: req.oauth2.redirectURI,
			state: areq.state || '',
			codeChallenge: areq.codeChallenge || '',
		});
	},
};

/**
 * OpenID Connect userinfo endpoint (OpenID Connect Core 3.1). Returns the
 * profile of the user the access token was issued for.
 *
 * A Bearer token is gated by its scopes: `openid` is required, and `email` /
 * `profile` control which additional claims are returned. A cookie session
 * (the user's own browser, `req.uid` set with no `req.oauth`) sees their full
 * profile, since they are acting on their own behalf.
 */
controller.userinfo = async (req, res) => {
	// A guest (no session, no valid Bearer token) has no profile to return.
	if (req.uid <= 0) {
		res.set('WWW-Authenticate', 'Bearer realm="oauth", error="invalid_token"');
		return res.status(401).json({
			error: 'invalid_token',
			error_description: 'A Bearer access token with the "openid" scope is required',
		});
	}

	const isBearer = !!req.oauth;
	const scopes = isBearer ? req.oauth.scopes : ['openid', 'email', 'profile'];

	if (isBearer && !scopes.includes('openid')) {
		res.set('WWW-Authenticate', 'Bearer realm="oauth", error="insufficient_scope"');
		return res.status(403).json({
			error: 'insufficient_scope',
			error_description: 'The "openid" scope is required',
		});
	}

	const userData = await user.getUserData(req.uid);
	if (!userData) {
		res.set('WWW-Authenticate', 'Bearer realm="oauth", error="invalid_token"');
		return res.status(401).json({
			error: 'invalid_token',
			error_description: 'The token is not associated with a known user',
		});
	}

	const payload = { sub: String(req.uid) };

	if (scopes.includes('email')) {
		payload.email = userData.email || null;
		payload.email_verified = userData['email:confirmed'] === 1 || userData['email:confirmed'] === '1';
	}

	if (scopes.includes('profile')) {
		payload.preferred_username = userData.username;
		if (userData.fullname) {
			payload.name = userData.fullname;
			const parts = userData.fullname.trim().split(/\s+/);
			payload.given_name = parts[0];
			if (parts.length > 1) {
				payload.family_name = parts.slice(1).join(' ');
			}
		}
		if (userData.picture) {
			payload.picture = /^https?:\/\//.test(userData.picture) ?
				userData.picture :
				`${nconf.get('url')}${userData.picture}`;
		}
		const memberOf = await groups.getUserGroups([req.uid]);
		payload.roles = (memberOf[0] || []).map(group => group.name);
	}

	res.json(payload);
};

/**
 * RFC 7009 token revocation. The client authenticates as with the token
 * endpoint (the token itself may belong to the client, or to a user on whose
 * behalf the client acts).
 */
controller.revoke = async (req, res) => {
	const { token, token_type_hint } = req.body || {};
	if (!token) {
		return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameter: token' });
	}

	let revoked = false;
	// RFC 7009 §2.1: a client may only revoke tokens issued to it. When no
	// token_type_hint is supplied the server must try both types.
	const types = token_type_hint === 'refresh_token' ? ['refresh_token', 'access_token'] : ['access_token', 'refresh_token'];
	for (const type of types) {
		if (revoked) {
			break;
		}
		if (type === 'refresh_token') {
			const refreshObj = await oauth.tokens.getRefreshToken(token);
			if (refreshObj && refreshObj.clientId === req.client.id) {
				revoked = await oauth.tokens.revokeRefreshToken(token);
			} else if (refreshObj) {
				break; // the token is known, but belongs to another client
			}
		} else {
			const tokenObj = await api.utils.tokens.get(token);
			if (tokenObj && tokenObj.clientId === req.client.id) {
				revoked = await oauth.tokens.revokeAccessToken(token);
			} else if (tokenObj) {
				break;
			}
		}
	}

	// Per RFC 7009 §2.1, the response is 200 whether or not the token was known
	res.status(200).json({ revoked });
};

/**
 * RFC 7591 dynamic client registration. Only public (PKCE) clients may be
 * registered this way; confidential clients are created by administrators.
 */
controller.register = async (req, res) => {
	const body = req.body || {};

	if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') {
		return res.status(400).json({
			error: 'invalid_client_metadata',
			error_description: 'Only public clients (token_endpoint_auth_method "none") can be self-registered',
		});
	}

	const redirectUris = body.redirect_uris;
	if (!Array.isArray(redirectUris) || !redirectUris.length) {
		return res.status(400).json({
			error: 'invalid_redirect_uri',
			error_description: 'redirect_uris must be a non-empty array',
		});
	}

	let scopes = [];
	if (body.scope) {
		try {
			scopes = oauth.scopes.validate(body.scope);
		} catch (e) {
			return res.status(400).json({ error: 'invalid_scope', error_description: 'Unknown scope requested' });
		}
	}

	const grants = (body.grant_types && body.grant_types.length) ? body.grant_types : ['authorization_code', 'refresh_token'];

	let client;
	try {
		({ client } = await oauth.clients.create({
			name: body.client_name || 'Self-registered client',
			description: body.client_description || '',
			redirectUris,
			grants: grants.filter(g => g !== 'client_credentials'),
			scopes,
			public: true,
		}));
	} catch (e) {
		winston.warn(`[oauth/register] ${e.message}`);
		return res.status(400).json({ error: 'invalid_client_metadata', error_description: e.message });
	}

	res.status(201).json({
		client_id: client.id,
		client_id_issued_at: Math.floor(Date.now() / 1000),
		client_name: client.name,
		redirect_uris: client.redirectUris,
		client_uri: body.client_uri || null,
		grant_types: client.grants,
		response_types: ['code'],
		token_endpoint_auth_method: 'none',
		scope: client.scopes.join(' '),
	});
};
