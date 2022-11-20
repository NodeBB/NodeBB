'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers').defualt;
const { setupApiRoute } = routeHelpers;
function default_1() {
    const middlewares = [middleware.ensureLoggedIn];
    setupApiRoute(router, 'post', '/', [...middlewares], controllers.write.flags.create);
    setupApiRoute(router, 'get', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.get);
    setupApiRoute(router, 'put', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.update);
    setupApiRoute(router, 'delete', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.delete);
    setupApiRoute(router, 'post', '/:flagId/notes', [...middlewares, middleware.assert.flag], controllers.write.flags.appendNote);
    setupApiRoute(router, 'delete', '/:flagId/notes/:datetime', [...middlewares, middleware.assert.flag], controllers.write.flags.deleteNote);
    return router;
}
exports.default = default_1;
;
