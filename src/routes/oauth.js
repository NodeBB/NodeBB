'use strict';

const nconf = require('nconf');

const middleware = require('../middleware');
const oauth = require('../oauth');

module.exports = function (app, router, mw, ctrls) {
	const relativePath = nconf.get('relative_path') || '';

	// RFC 8414 authorization server metadata (mounted at the instance root,
	// like the other /.well-known routes)
	app.get('/.well-known/oauth-authorization-server', async (req, res) => {
		res.json(await oauth.getMetadata());
	});

	// -----------------------------------------------------------------------
	// Authorization endpoint
	// -----------------------------------------------------------------------

	const requireLogin = (req, res, next) => {
		if (req.loggedIn) {
			return next();
		}
		const nextUrl = encodeURIComponent(req.originalUrl.replace(relativePath, ''));
		return res.redirect(`${relativePath}/login?next=${nextUrl}`);
	};

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

	const authorizeMiddlewares = [
		middleware.authenticateRequest,
		requireLogin,
		oauth.resolveRequestUri(),
		oauth.getServer().authorize({}, oauth.validateAuthorizationRequest, undefined, oauth.completeAuthorizationRequest),
		ctrls.oauth.authorize.get,
	];

	// `/oauth/authorize` serves the HTML consent screen; `/api/oauth/authorize`
	// serves the same payload as JSON (via the render middleware's isAPI check).
	router.get('/oauth/authorize', authorizeMiddlewares, oauth.authorizationErrorHandler());
	router.get('/api/oauth/authorize', authorizeMiddlewares, oauth.authorizationErrorHandler());

	router.post('/oauth/authorize',
		middleware.authenticateRequest,
		requireLogin,
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
