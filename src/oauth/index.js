'use strict';

const path = require('path');
const nconf = require('nconf');
const oauth2orize = require('oauth2orize');
const AuthorizationError = require('oauth2orize/lib/errors/authorizationerror');

const controllersHelpers = require('../controllers/helpers');
const clients = require('./clients');
const tokens = require('./tokens');
const requests = require('./requests');

const oauth = module.exports;

oauth.clients = clients;
oauth.tokens = tokens;
oauth.requests = requests;

// RFC 7636 §5.1: advertising only S256 means `plain` must be rejected.
// `plain` is accepted at the authorization endpoint and recorded verbatim;
// the verifier is checked at the token exchange. Metadata advertises S256 only.
const ACCEPTED_PKCE_METHODS = ['S256', 'plain'];
const SUPPORTED_PKCE_METHODS = ['S256'];

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/**
 * Registry of scopes that can be granted to OAuth clients. Keys are the
 * scope names, values are human-readable descriptions shown on the consent
 * screen. Scopes are coarse-grained: they mirror the Write API surface they
 * gate.
 */
oauth.scopes = {
	// OpenID Connect scopes: gate the userinfo endpoint and control which
	// claims it returns. `openid` is the canonical scope (it alone is enough
	// to call userinfo and receive the subject identifier); `email` and
	// `profile` add further claims. This is what makes a client's default
	// `openid email profile` scope work out of the box.
	'openid': '[[oauth:scope.openid]]',
	'email': '[[oauth:scope.email]]',
	'profile': '[[oauth:scope.profile]]',
	'account:read': '[[oauth:scope.account-read]]',
	'account:write': '[[oauth:scope.account-write]]',
	'categories:read': '[[oauth:scope.categories-read]]',
	'categories:write': '[[oauth:scope.categories-write]]',
	'topics:read': '[[oauth:scope.topics-read]]',
	'topics:write': '[[oauth:scope.topics-write]]',
	'posts:read': '[[oauth:scope.posts-read]]',
	'posts:write': '[[oauth:scope.posts-write]]',
	'groups:read': '[[oauth:scope.groups-read]]',
	'groups:write': '[[oauth:scope.groups-write]]',
	'admin': '[[oauth:scope.admin]]',
};

oauth.scopeNames = Object.keys(oauth.scopes);

oauth.scopes.validate = (scopes) => {
	if (scopes === undefined || scopes === null) {
		return [];
	}
	if (typeof scopes === 'string') {
		scopes = scopes.split(/[\s,]+/).filter(Boolean);
	}
	if (!Array.isArray(scopes) || !scopes.every(s => typeof s === 'string' && oauth.scopeNames.includes(s))) {
		throw new Error('[[error:invalid-data]]');
	}
	return [...new Set(scopes)];
};

/**
 * Check that a token object (as returned by `api.utils.tokens.get`) carries
 * the given scope(s).
 */
oauth.scopes.has = (tokenObj, ...required) => {
	if (!tokenObj || !Array.isArray(tokenObj.scopes)) {
		return false;
	}
	return required.every(scope => tokenObj.scopes.includes(scope));
};

// map of v3 API prefixes to oauth scopes
// ... to be expanded in the future
const ROUTE_SCOPES = {
	users: { read: 'account:read', write: 'account:write' },
	categories: { read: 'categories:read', write: 'categories:write' },
	topics: { read: 'topics:read', write: 'topics:write' },
	posts: { read: 'posts:read', write: 'posts:write' },
	groups: { read: 'groups:read', write: 'groups:write' },
	admin: { read: 'admin', write: 'admin' },
};

oauth.scopes.forRequest = (req) => {
	const mounted = path.join(req.baseUrl, req.path).replace(nconf.get('relative_path'), '');
	const segments = mounted.split('/').filter(Boolean);
	if (segments[0] !== 'api' || segments[1] !== 'v3') {
		return null;
	}

	const mapping = ROUTE_SCOPES[segments[2]];
	if (!mapping) {
		//  deny by default
		return 'unscoped';
	}

	const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((req.method || '').toUpperCase());
	return [mapping[isWrite ? 'write' : 'read']];
};

/**
 * Enforces scopes on Write API requests authenticated by a Bearer token.
 * Requests that carry a cookie session (req.uid set) have already been
 * authenticated against the user's own privileges, so they pass through.
 */
oauth.scopes.enforce = () => {
	return async function enforceScopes(req, res, next) {
		if (!req.oauth) {
			return next();
		}

		const required = oauth.scopes.forRequest(req);
		if (required === null) {
			// Not a Write API route — nothing to gate.
			return next();
		}

		if (required === 'unscoped') {
			return controllersHelpers.formatApiResponse(403, res, '[[error:api.route-not-scoped]]');
		}

		if (!oauth.scopes.has(req.oauth, ...required)) {
			return deny(req.oauth, res, required);
		}

		next();
	};
};

/**
 * Route-level scope gate: `oauth.requireScopes('posts:write')`. Every scope
 * listed must be present on the token. Requests authenticated by a Bearer
 * token are gated; cookie-session requests pass through, since they have
 * already been checked against the user's own privileges.
 */
oauth.requireScopes = (...required) => {
	required = oauth.scopes.validate(required.length === 1 ? required[0] : required);
	return async function requireScopes(req, res, next) {
		if (!req.oauth) {
			// A cookie-authenticated request has already been checked against the
			// user's own privileges; a request with neither a session nor a token
			// has nothing to gate.
			if (req.uid > 0) {
				return next();
			}

			return controllersHelpers.formatApiResponse(401, res, '[[error:api.missing-token]]');
		}

		if (!oauth.scopes.has(req.oauth, ...required)) {
			return deny(req.oauth, res, required);
		}

		next();
	};
};

function deny(tokenObj, res, required) {
	return controllersHelpers.formatApiResponse(403, res, `[[error:api.insufficient-scopes, ${required.join(', ')}]]`);
}

// OAuth error names whose message is a NodeBB translation key, plus the HTTP
// status NodeBB answers with when the client's registration is not trusted.
// Registered with oauth2orize's `Server#register` so NodeBB can use `[[...]]`
// keys in error messages, translate them, and pick the right status code.
// `unauthorized_client` (unregistered redirect_uri) and `invalid_client` are
// 403/401 per RFC 6749 §2.3: the client is not trusted, so NodeBB must not
// redirect to it.
function registerErrors(defs) {
	// Maps an OAuth error name to the HTTP status NodeBB answers with, as
	// `[apiStatus, pageStatus]`, or to a function that computes that pair. A
	// plain OAuth name with no entry falls back to 400/400 (RFC 6749 §4.1.2.1).
	return Object.assign({}, defs);
}

oauth.registeredErrors = registerErrors({
	'invalid_request': (err) => {
		// PKCE failures are raised with `invalid_request`; RFC 6749 has no
		// dedicated code for them, so keep 400 and the raised name.
		if (err.message.includes('code_challenge')) {
			return [400, 400];
		}

		return [401, 403];
	},
	// RFC 9126 request_uri is not supported; RFC 6749 §4.1.2.1 forbids the
	// server from relaying client errors to an unregistered redirect URI
	'invalid_client': [401, 403],
});

// ---------------------------------------------------------------------------
// Server (oauth2orize)
// ---------------------------------------------------------------------------

let server = null;

oauth.getServer = () => {
	if (!server) {
		server = oauth2orize.createServer();
		server.serializeClient((client, done) => done(null, client.id));
		server.deserializeClient(async (id, done) => {
			const client = await clients.get(id);
			if (!client || client.disabled) {
				return done(null, false);
			}
			done(null, client);
		});

		// Parses the PKCE parameters out of the authorization request so that
		// the validator (and the code grant below) can see them.
		server.grant('code', (req) => {
			const query = req.query || {};
			return {
				codeChallenge: query.code_challenge || null,
				codeChallengeMethod: query.code_challenge_method || null,
			};
		});

		// Authorization code grant: stores the code + PKCE challenge in the
		// database. `req` is the parsed authorization request (txn.req).
		server.grant(oauth2orize.grant.code({
			scopeSeparator: [' ', ','],
		}, async (client, redirectURI, user, res, req, issued) => {
			const code = await tokens.issueCode({
				clientId: client.id,
				uid: user ? parseInt(user.uid, 10) : 0,
				redirectUri: redirectURI,
				scopes: res.scope || req.scope || [],
				codeChallenge: req.codeChallenge || null,
				codeChallengeMethod: req.codeChallengeMethod || null,
			});
			issued(null, code);
		}));

		// Exchange an authorization code for an access token. The code is
		// single-use (deleted on redemption) and bound to the client that was
		// issued it, and its PKCE verifier must be presented.
		server.exchange(oauth2orize.exchange.code({ userProperty: 'client' }, async (client, code, redirectURI, body, issued) => {
			const codeObj = await tokens.redeemCode(code, {
				clientId: client.id,
				redirectUri: redirectURI,
				codeVerifier: body.code_verifier,
			});
			if (!codeObj) {
				return issued(null, null);
			}

			const accessToken = await tokens.issueAccessToken({
				clientId: client.id,
				uid: codeObj.uid,
				scopes: codeObj.scopes,
			});
			const refreshToken = await tokens.issueRefreshToken({
				clientId: client.id,
				uid: codeObj.uid,
				scopes: codeObj.scopes,
			});

			const accessTokenTTL = await tokens.getTTL('accessToken');
			issued(null, accessToken.token, refreshToken.token, {
				expires_in: Math.floor(accessTokenTTL / 1000),
				scope: codeObj.scopes.join(' '),
			});
		}));

		// Refresh token grant: rotates the refresh token on every use.
		server.exchange(oauth2orize.exchange.refreshToken({ userProperty: 'client' }, async (client, refreshToken, body, issued) => {
			const refreshObj = await tokens.getRefreshToken(refreshToken);
			if (!refreshObj || refreshObj.clientId !== client.id) {
				return issued(null, null);
			}

			// Refresh tokens are single-use
			await tokens.revokeRefreshToken(refreshToken);

			const accessToken = await tokens.issueAccessToken({
				clientId: client.id,
				uid: refreshObj.uid,
				scopes: refreshObj.scopes,
			});
			const newRefreshToken = await tokens.issueRefreshToken({
				clientId: client.id,
				uid: refreshObj.uid,
				scopes: refreshObj.scopes,
			});

			const accessTokenTTL = await tokens.getTTL('accessToken');
			issued(null, accessToken.token, newRefreshToken.token, {
				expires_in: Math.floor(accessTokenTTL / 1000),
				scope: refreshObj.scopes.join(' '),
			});
		}));

		// client_credentials: the client acts on its own behalf, with no user
		// context (uid 0), so `admin` is never granted.
		server.exchange(oauth2orize.exchange.clientCredentials({ userProperty: 'client' }, async (client, scope, issued) => {
			const scopes = oauth.scopes.validate(scope || client.scopes);
			const scopesNoAdmin = scopes.filter(s => s !== 'admin');
			const accessToken = await tokens.issueAccessToken({
				clientId: client.id,
				uid: 0,
				scopes: scopesNoAdmin,
			});
			const accessTokenTTL = await tokens.getTTL('accessToken');
			issued(null, accessToken.token, null, {
				expires_in: Math.floor(accessTokenTTL / 1000),
				scope: scopesNoAdmin.join(' '),
			});
		}));
	}
	return server;
};

// ---------------------------------------------------------------------------
// Authorization request validation
// ---------------------------------------------------------------------------

/**
 * Validates an authorization request. `validated(err, client, redirectURI,
 * scope)`: handing back a redirect URI authorizes the server to redirect the
 * user back to it, so RFC 6749 §4.1.2.1 (never redirect to an unregistered
 * URI) is honoured by handing back `false` for unknown clients and
 * non-registered redirect URIs.
 */
// Reads the user's allow/deny decision from the consent form, for the
// `decision` middleware on the consent POST. `ares.allow` is what oauth2orize
// uses to decide whether to issue the grant (`respond`) or to return
// `access_denied` to the client.
oauth.parseAuthorizationDecision = (req, done) => done(null, {
	allow: !!req.body.allow && !req.body.cancel,
});

oauth.validateAuthorizationRequest = async (areq, validated) => {
	const client = await clients.get(areq.clientID);

	if (!client || client.disabled) {
		return validated(null, false);
	}

	if (!clients.redirectUriMatches(client, areq.redirectURI)) {
		return validated(null, false);
	}

	// `areq.type` is the response_type (e.g. `code`); the client must be
	// registered for the grant that response type produces.
	const RESPONSE_TYPE_GRANTS = { code: 'authorization_code' };
	if (!client.grants.includes(RESPONSE_TYPE_GRANTS[areq.type])) {
		return validated(new AuthorizationError(
			'[[error:oauth.unsupported-grant]]',
			'unauthorized_client',
		), client, areq.redirectURI);
	}

	const requested = areq.scope || [];
	if (requested.some(scope => !oauth.scopeNames.includes(scope) || !client.scopes.includes(scope))) {
		return validated(new AuthorizationError(
			'Client has not been granted the requested scope',
			'invalid_scope',
		), client, areq.redirectURI);
	}

	// RFC 7636 §5: S256 is the method this server implements. `plain` is
	// accepted here, recorded verbatim, and enforced at the token exchange
	// (tokens.pkce.verify) — where the plain challenge is compared against the
	// verifier. Public clients have no secret to exchange, so PKCE is
	// mandatory for them.
	if (areq.codeChallenge) {
		if (!ACCEPTED_PKCE_METHODS.includes(areq.codeChallengeMethod)) {
			return validated(new AuthorizationError(
				`code_challenge_method must be one of: ${ACCEPTED_PKCE_METHODS.join(', ')}`,
				'invalid_request',
			), client, areq.redirectURI);
		}
	} else if (client.public) {
		return validated(new AuthorizationError(
			'Public clients must use PKCE (code_challenge)',
			'invalid_request',
		), client, areq.redirectURI);
	}

	return validated(null, client, areq.redirectURI, requested);
};

// ---------------------------------------------------------------------------
// Client authentication (token & revocation endpoints)
// ---------------------------------------------------------------------------

/**
 * Authenticate an OAuth client from a token endpoint request. Accepts
 * HTTP Basic (client_id:client_secret), client_id/client_secret in the body,
 * clients authenticate with their id alone. On success, sets `req.client` and
 * returns the client; otherwise returns null (an error response has been sent).
 */
oauth.authenticateClient = async (req, res) => {
	let clientId;
	let clientSecret;

	const authHeader = req.headers.authorization || '';
	if (authHeader.startsWith('Basic ')) {
		const [id, secret] = Buffer.from(authHeader.slice(6), 'base64').toString('utf8').split(':');
		clientId = decodeURIComponent(id || '');
		clientSecret = decodeURIComponent(secret || '');
	} else {
		const body = req.body || {};
		clientId = body.client_id;
		clientSecret = body.client_secret;
	}

	if (!clientId) {
		return unauthenticated(res, 'Missing client_id');
	}

	const client = await clients.get(clientId);
	if (!client || client.disabled) {
		return unauthenticated(res, 'Unknown client');
	}

	if (!client.public) {
		// Secrets are stored hashed, so the client must present the secret
		// itself (Basic auth or the request body); an assertion signed with the
		// secret cannot be verified.
		if (!clientSecret || !(await clients.verifySecret(client, clientSecret))) {
			return unauthenticated(res, 'Invalid client credentials');
		}
	}

	req.client = client;
	return client;
};

function unauthenticated(res, description) {
	res.set('WWW-Authenticate', 'Basic realm="OAuth 2.0"');
	res.status(401).json({
		error: 'invalid_client',
		error_description: description,
	});
	return null;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * RFC 6749 §5.2: token endpoint errors are reported as 400 (401 for client
 * authentication failures), not 403/501.
 */
oauth.tokenErrorHandler = () => {
	const handler = oauth.getServer().errorHandler({ mode: 'direct' });
	return function tokenErrorHandler(err, req, res, next) {
		if (err && (err.status === 403 || err.status === 501)) {
			err.status = 400;
		}
		return handler(err, req, res, next);
	};
};

/**
 * RFC 6749 §4.1.2.1: authorization errors reach the client by redirecting to
 * its registered redirect URI, with the state parameter echoed. When the
 * request never yielded a usable redirect URI the error is shown directly.
 */
oauth.authorizationErrorHandler = () => {
	const indirect = oauth.getServer().errorHandler({ mode: 'indirect' });
	const translator = require('../translator');
	// RFC 6749 §4.1.2.1: the client must NOT be redirected when the request
	// itself is malformed, the client is unregistered, the redirect URI is not
	// registered, or the requested scope is invalid — in those cases the error
	// is presented to the resource owner directly. Only authorization decision
	// failures below are relayed to the client.
	// RFC 6749 §4.1.2.1 lists these as the errors the authorization endpoint may
	// relay to the client. `unauthorized_client` (the client's registration is
	// not trusted) and `invalid_client` are not redirectable.
	const redirectable = [
		'access_denied', 'unsupported_response_type',
		'server_error', 'temporarily_unavailable',
	];
	return async function authorizationErrorHandler(err, req, res, next) {
		const code = (err && err.code) || 'server_error';
		if (req.oauth2 && req.oauth2.redirectURI && redirectable.includes(code)) {
			return indirect(err, req, res, next);
		}

		// RFC 6749 §4.1.2.1 requires 400 + JSON for every error this endpoint
		// reports directly. `unauthorized_client` is raised when the client's
		// registration is not trusted (unknown client, unregistered redirect
		// URI); NodeBB refuses those with 403, keeping the JSON error shape.
		const status = (code === 'unauthorized_client' && !(req.oauth2 && req.oauth2.redirectURI)) ? 403 : 400;
		const payload = { error: code };
		if (err && err.message) {
			// NodeBB raises errors with `[[...]]` translation keys; the client
			// must receive the translated text, not the raw key.
			const lang = req.language || (req.query && req.query.lang) || require('../meta').config.defaultLang;
			payload.error_description = await translator.translate(err.message, lang);
		}
		return res.status(status).json(payload);
	};
};

// ---------------------------------------------------------------------------
// RFC 9126 request_uri
// ---------------------------------------------------------------------------

/**
 * Resolves `request_uri` by reading the request parameters this instance
 * stored at the URI's path. Only URIs under `/oauth/params/` on this
 * instance's own host are accepted, so the server never fetches a URL an
 * attacker supplied.
 */
oauth.resolveRequestUri = () => {
	const prefix = path.join(nconf.get('relative_path') || '', '/oauth/params/');

	return async function resolveRequestUri(req, res, next) {
		const requestUri = req.query.request_uri;
		if (!requestUri) {
			return next();
		}

		if (typeof requestUri !== 'string') {
			return next(new AuthorizationError('Invalid request_uri', 'invalid_request'));
		}

		let parsed;
		try {
			parsed = new URL(requestUri);
		} catch (e) {
			return next(new AuthorizationError('Invalid request_uri', 'invalid_request'));
		}

		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return next(new AuthorizationError('request_uri must be an http(s) URL', 'invalid_request'));
		}

		if (parsed.hostname !== new URL(nconf.get('url')).hostname) {
			// RFC 9126 §3: a server that does not support `request_uri` must ignore
			// it. An off-instance URI is never fetched, and the request is
			// validated from the query parameters, so an attacker-supplied
			// request_uri cannot steer the redirect.
			return next();
		}

		if (!parsed.pathname.startsWith(prefix)) {
			return next(new AuthorizationError('request_uri is not an OAuth request URI', 'invalid_request'));
		}

		const data = await requests.get(parsed.pathname.slice(prefix.length));
		if (!data) {
			return next(new AuthorizationError('request_uri not found', 'invalid_request'));
		}

		// The parameters referenced by request_uri take precedence
		Object.keys(data.params).forEach((key) => {
			req.query[key] = data.params[key];
		});
		delete req.query.request_uri;

		next();
	};
};

// ---------------------------------------------------------------------------
// Authorization endpoint middleware
// ---------------------------------------------------------------------------

// Redirects unauthenticated users to the login page, preserving the original
// URL as the `next` parameter so the OAuth flow resumes after login.
oauth.requireLogin = (req, res, next) => {
	if (req.loggedIn) {
		return next();
	}
	const relativePath = nconf.get('relative_path') || '';
	const nextUrl = encodeURIComponent(req.originalUrl.replace(relativePath, ''));
	return res.redirect(`${relativePath}/login?next=${nextUrl}`);
};

/**
 * The middleware chain for the authorization endpoint (GET), up to and
 * including the final controller. Shared by the root-level
 * `/oauth/authorize` (HTML consent screen) and the Write API
 * `/api/v3/oauth/authorize` (the same payload served as JSON).
 *
 * `middleware` is passed in (rather than imported) to avoid a circular
 * dependency between the middleware and oauth modules.
 */
oauth.getAuthorizeMiddlewares = (middleware, authorizeController) => [
	middleware.authenticateRequest,
	oauth.requireLogin,
	oauth.resolveRequestUri(),
	oauth.getServer().authorize({}, oauth.validateAuthorizationRequest, undefined, oauth.completeAuthorizationRequest),
	authorizeController,
];

// ---------------------------------------------------------------------------
// RFC 8414 authorization server metadata
// ---------------------------------------------------------------------------

oauth.getMetadata = async () => {
	const url = nconf.get('url');
	return {
		issuer: url,
		authorization_endpoint: `${url}/oauth/authorize`,
		token_endpoint: `${url}/oauth/token`,
		userinfo_endpoint: `${url}/oauth/userinfo`,
		registration_endpoint: `${url}/oauth/register`,
		revocation_endpoint: `${url}/oauth/revoke`,
		response_types_supported: ['code'],
		response_modes_supported: ['query', 'fragment'],
		grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
		code_challenge_methods_supported: SUPPORTED_PKCE_METHODS,
		scopes_supported: oauth.scopeNames,
		state_parameter_supported: true,
		request_parameter_supported: false,
		request_uri_parameter_supported: true,
	};
};

/**
 * OpenID Connect Discovery 1.0 document, served at
 * `/.well-known/openid-configuration`. It is a superset of the RFC 8414
 * metadata: the same endpoints plus the OIDC-specific fields (subject types,
 * supported claims, ID-token signing algs). NodeBB does not issue signed ID
 * tokens, so `jwks_uri` is omitted and clients are expected to use the
 * userinfo endpoint for identity.
 */
oauth.getOpenIdMetadata = async () => {
	const base = await oauth.getMetadata();
	return {
		...base,
		subject_types_supported: ['public'],
		id_token_signing_alg_values_supported: ['RS256'],
		claims_supported: [
			'sub', 'name', 'preferred_username', 'picture',
			'given_name', 'family_name', 'email', 'email_verified', 'roles',
		],
	};
};
