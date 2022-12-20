'use strict';

import { Router } from 'express';
import middleware from '../../middleware';
import controllers from '../../controllers';
import routeHelpers from '../helpers';

const { setupApiRoute } = routeHelpers;
const router = Router();

export default function () {
	// The "ping" routes are mounted at root level, but for organizational purposes, the controllers are in `utilities.js`

	setupApiRoute(router, 'post', '/login', [middleware.checkRequired.bind(null, ['username', 'password'])], controllers.write.utilities.login);

	return router;
};
