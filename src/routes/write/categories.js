'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['name']), middleware.isAdmin], 'post', controllers.write.categories.create);
	setupApiRoute(router, '/:cid', middleware, [...middlewares, middleware.isAdmin], 'put', controllers.write.categories.update);
	setupApiRoute(router, '/:cid', middleware, [...middlewares, middleware.isAdmin], 'delete', controllers.write.categories.delete);

	// Category disabled state is deprecated, so this route won't be ported over
	// app.route('/:cid/state')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.requireAdmin, apiMiddleware.validateCid, function(req, res) {
	// 		var payload = {};
	// 		payload[req.params.cid] = {
	// 			disabled: 0
	// 		};

	// 		Categories.update(payload, function(err) {
	// 			return errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.requireAdmin, apiMiddleware.validateCid, function(req, res) {
	// 		var payload = {};
	// 		payload[req.params.cid] = {
	// 			disabled: 1
	// 		};

	// 		Categories.update(payload, function(err) {
	// 			return errorHandler.handle(err, res);
	// 		});
	// 	});

	// app.route('/:cid/privileges')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.requireAdmin, apiMiddleware.validateCidIncludingGlobal, function(req, res) {
	// 		changeGroupMembership(req.params.cid, req.body.privileges, req.body.groups, 'join', function(err) {
	// 			return errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.requireAdmin, apiMiddleware.validateCidIncludingGlobal, function(req, res) {
	// 		changeGroupMembership(req.params.cid, req.body.privileges, req.body.groups, 'leave', function(err) {
	// 			return errorHandler.handle(err, res);
	// 		});
	// 	});

	// function changeGroupMembership(cid, privileges, groups, action, callback) {
	// 	privileges = Array.isArray(privileges) ? privileges : [privileges];
	// 	groups = Array.isArray(groups) ? groups : [groups];

	// 	async.each(groups, function(group, groupCb) {
	// 		async.each(privileges, function(privilege, privilegeCb) {
	// 			Groups[action]('cid:' + cid + ':privileges:' + privilege, group, privilegeCb);
	// 		}, groupCb);
	// 	}, callback);
	// }

	return router;
};
