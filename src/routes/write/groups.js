'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['name']), middleware.exposePrivilegeSet], 'post', controllers.write.groups.create);
	setupApiRoute(router, '/:slug', middleware, [...middlewares, middleware.assertGroup, middleware.exposePrivileges], 'delete', controllers.write.groups.delete);
	setupApiRoute(router, '/:slug/membership/:uid', middleware, [...middlewares, middleware.assertGroup, middleware.exposePrivileges], 'put', controllers.write.groups.join);

	// app.put('/:slug/membership/:uid', middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
	// 	Groups.join(res.locals.groupName, req.params.uid, function(err) {
	// 		errorHandler.handle(err, res);
	// 	});
	// });

	// app.delete('/:slug/membership', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, function(req, res) {
	// 	Groups.isMember(req.user.uid, res.locals.groupName, function(err, isMember) {
	// 		if (isMember) {
	// 			Groups.leave(res.locals.groupName, req.user.uid, function(err) {
	// 				errorHandler.handle(err, res);
	// 			});
	// 		} else {
	// 			errorHandler.respond(400, res);
	// 		}
	// 	});
	// });

	// app.delete('/:slug/membership/:uid', middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
	//     Groups.isMember(req.params.uid, res.locals.groupName, function(err, isMember) {
	//         if (isMember) {
	//             Groups.leave(res.locals.groupName, req.params.uid, function(err) {
	//                 errorHandler.handle(err, res);
	//             });
	//         } else {
	//             errorHandler.respond(400, res);
	//         }
	//     });
	// });

	return router;
};
