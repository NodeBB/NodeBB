'use strict';

import { Router } from 'express';
import middleware from '../../middleware';
import controllers from '../../controllers';
import routeHelpers from '../helpers';

const { setupApiRoute } = routeHelpers;
const router = Router();

export default function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'post', '/', [...middlewares], controllers.write.flags.create);

	setupApiRoute(router, 'get', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.get);
	setupApiRoute(router, 'put', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.update);
	setupApiRoute(router, 'delete', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.delete);

	setupApiRoute(router, 'post', '/:flagId/notes', [...middlewares, middleware.assert.flag], controllers.write.flags.appendNote);
	setupApiRoute(router, 'delete', '/:flagId/notes/:datetime', [...middlewares, middleware.assert.flag], controllers.write.flags.deleteNote);

	return router;
};
