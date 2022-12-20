'use strict';

import { Router } from 'express';
import middleware from '../../middleware';
import controllers from '../../controllers';
import routeHelpers from '../helpers';

const { setupApiRoute } = routeHelpers;
const router = Router();

export default function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name'])], controllers.write.categories.create);
	setupApiRoute(router, 'get', '/:cid', [], controllers.write.categories.get);
	setupApiRoute(router, 'put', '/:cid', [...middlewares], controllers.write.categories.update);
	setupApiRoute(router, 'delete', '/:cid', [...middlewares], controllers.write.categories.delete);

	setupApiRoute(router, 'get', '/:cid/privileges', [...middlewares], controllers.write.categories.getPrivileges);
	setupApiRoute(router, 'put', '/:cid/privileges/:privilege', [...middlewares, middleware.checkRequired.bind(null, ['member'])], controllers.write.categories.setPrivilege);
	setupApiRoute(router, 'delete', '/:cid/privileges/:privilege', [...middlewares, middleware.checkRequired.bind(null, ['member'])], controllers.write.categories.setPrivilege);

	setupApiRoute(router, 'put', '/:cid/moderator/:uid', [...middlewares], controllers.write.categories.setModerator);
	setupApiRoute(router, 'delete', '/:cid/moderator/:uid', [...middlewares], controllers.write.categories.setModerator);

	return router;
};
