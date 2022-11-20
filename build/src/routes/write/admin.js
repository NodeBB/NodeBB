'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers').defualt;
const { setupApiRoute } = routeHelpers;
function default_1() {
    const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];
    setupApiRoute(router, 'put', '/settings/:setting', [...middlewares, middleware.checkRequired.bind(null, ['value'])], controllers.write.admin.updateSetting);
    setupApiRoute(router, 'get', '/analytics', [...middlewares], controllers.write.admin.getAnalyticsKeys);
    setupApiRoute(router, 'get', '/analytics/:set', [...middlewares], controllers.write.admin.getAnalyticsData);
    return router;
}
exports.default = default_1;
;
