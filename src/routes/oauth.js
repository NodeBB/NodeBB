'use strict';

const middleware = require('../middleware');
const oauth = require('../oauth');

module.exports = function (app, router, mw, ctrls) {
	// RFC 8414 authorization server metadata (mounted at the instance root,
	// like the other /.well-known routes)
	app.get('/.well-known/oauth-authorization-server', async (req, res) => {
		res.json(await oauth.getMetadata());
	});

	// OpenID Connect Discovery 1.0 (a superset of the RFC 8414 metadata), at
	// the canonical OIDC well-known URL.
	app.get('/.well-known/openid-configuration', async (req, res) => {
		res.json(await oauth.getOpenIdMetadata());
	});

	// -----------------------------------------------------------------------
	// Authorization endpoint
	// -----------------------------------------------------------------------

	// csrf-sync signals a CSRF failure by forwarding its `EBADCSRFTOKEN`
	// error, whose code is not an OAuth registered error. Intercept it here so
	// the consent POST answers with the standard `invalid_request` shape, and
	// never relay it to the client (RFC 6749 §4.1.2.1).
	const csrfErrorHandler = (err, req, res, next) => {
		if (err.code !== 'EBADCSRFTOKEN') {
			return next(err);
		}

		return res.status(400).json({
			error: 'invalid_request',
			error_description: 'Invalid CSRF token',
		});
	};

	// `/oauth/authorize` serves the HTML consent screen. The Write API exposes
	// the same payload as JSON at `/api/v3/oauth/authorize` (see
	// src/routes/write/oauth.js).
	router.get('/oauth/authorize', oauth.getAuthorizeMiddlewares(middleware, ctrls.oauth.authorize.get), oauth.authorizationErrorHandler());

	router.post('/oauth/authorize',
		middleware.authenticateRequest,
		oauth.requireLogin,
		mw.applyCSRF,
		csrfErrorHandler,
		...oauth.getServer().decision({ userProperty: 'user' }, oauth.parseAuthorizationDecision, oauth.completeAuthorizationRequest),
		oauth.authorizationErrorHandler());

	// -----------------------------------------------------------------------
	// Token endpoint
	// -----------------------------------------------------------------------

	const checkTokenRequest = (req, res, next) => {
		// RFC 6749 §2.3: the token endpoint always authenticates the client,
		// for every grant type.
		if (!req.client) {
			return res.status(401).json({
				error: 'invalid_client',
				error_description: 'Client authentication required',
			});
		}

		const grantType = (req.body || {}).grant_type;
		if (!grantType) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'Missing required parameter: grant_type',
			});
		}

		const allowed = req.client.grants.includes(grantType) ||
			// A client registered for the authorization_code grant may refresh
			// the refresh token it obtains from it
			(grantType === 'refresh_token' && req.client.grants.includes('authorization_code'));

		// Public clients cannot be authenticated confidentially, so they cannot
		// act on their own behalf (RFC 6749 §2.3.1)
		if (grantType === 'client_credentials' && req.client.public) {
			return res.status(400).json({
				error: 'unauthorized_client',
				error_description: 'Public clients cannot use the client_credentials grant',
			});
		}

		if (!allowed) {
			return res.status(400).json({
				error: 'unauthorized_client',
				error_description: `Client is not authorized to use grant type ${grantType}`,
			});
		}
		next();
	};

	router.post('/oauth/token',
		async (req, res, next) => {
			try {
				const client = await oauth.authenticateClient(req, res);
				if (!client) {
					return;
				}
				next();
			} catch (e) {
				next(e);
			}
		},
		checkTokenRequest,
		oauth.getServer().token(),
		oauth.tokenErrorHandler());

	// -----------------------------------------------------------------------
	// Userinfo endpoint (OpenID Connect Core 3.1)
	// -----------------------------------------------------------------------

	// Bearer-token (and cookie-session) authenticated. The Write API exposes
	// the same payload as JSON at `/api/v3/oauth/userinfo` (see
	// src/routes/write/oauth.js).
	router.get('/oauth/userinfo', middleware.authenticateRequest, ctrls.oauth.userinfo);

	// -----------------------------------------------------------------------
	// Revocation endpoint (RFC 7009)
	// -----------------------------------------------------------------------

	router.post('/oauth/revoke',
		async (req, res, next) => {
			try {
				const client = await oauth.authenticateClient(req, res);
				if (!client) {
					return;
				}
				next();
			} catch (e) {
				next(e);
			}
		},
		ctrls.oauth.revoke,
		oauth.tokenErrorHandler());

	// -----------------------------------------------------------------------
	// Dynamic client registration (RFC 7591)
	// -----------------------------------------------------------------------

	// -----------------------------------------------------------------------
	// RFC 9126 request_uri: a logged-in user (or admin) can register a
	// by-reference authorization request, which clients pass as request_uri.
	// -----------------------------------------------------------------------

	router.post('/oauth/params', mw.applyCSRF, mw.ensureLoggedIn, ctrls.oauth.requests.create);
	router.get('/oauth/params/:id', ctrls.oauth.requests.get);

	router.post('/oauth/register', ctrls.oauth.register, oauth.tokenErrorHandler());
};
