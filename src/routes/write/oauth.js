'use strict';

const router = require('express').Router();
const controllers = require('../../controllers');
const middleware = require('../../middleware');
const oauth = require('../../oauth');

module.exports = function () {
	// The authorization endpoint, served as JSON. The root-level
	// `/oauth/authorize` serves the HTML consent screen; this serves the same
	// payload as JSON (the Write API's `isAPI` flag switches the render
	// middleware to JSON).
	//
	// These routes intentionally bypass `setupApiRoute`: `oauth.scopes.enforce()`
	// would deny Bearer tokens here (no scope mapping), but the userinfo
	// endpoint is meant to be reached *with* a Bearer token.
	router.get('/authorize', oauth.getAuthorizeMiddlewares(middleware, controllers.oauth.authorize.get), oauth.authorizationErrorHandler());

	// The OpenID Connect userinfo endpoint. Bearer-token (and cookie-session)
	// authenticated; gated on the `openid` scope.
	router.get('/userinfo', middleware.authenticateRequest, controllers.oauth.userinfo);

	return router;
};
