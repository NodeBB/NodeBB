'use strict';

const router = require('express').Router();
const controllers = require('../../controllers');
const middleware = require('../../middleware');
const oauth = require('../../oauth');

module.exports = function () {
	router.get('/authorize', oauth.getAuthorizeMiddlewares(middleware, controllers.oauth.authorize.get), oauth.authorizationErrorHandler());
	router.get('/userinfo', middleware.authenticateRequest, controllers.oauth.userinfo);

	return router;
};
