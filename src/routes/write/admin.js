'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];

	setupApiRoute(router, 'put', '/settings/:setting', [...middlewares, middleware.checkRequired.bind(null, ['value'])], controllers.write.admin.updateSetting);

	setupApiRoute(router, 'get', '/analytics', [...middlewares], controllers.write.admin.getAnalyticsKeys);
	setupApiRoute(router, 'get', '/analytics/:set', [...middlewares], controllers.write.admin.getAnalyticsData);
	const requireAPIReAuth = middleware.requireAPIReAuth();
	async function tokenCreateMiddleware(req, res, next) {
		const uid = String(req.body.uid).trim();
		if (uid === '0') {
			// creating master token requires password
			await middleware.requirePasswordAuth(req, res, next);
		} else {
			await requireAPIReAuth(req, res, next);
		}
	}

	setupApiRoute(router, 'post', '/tokens', [...middlewares, tokenCreateMiddleware], controllers.write.admin.generateToken);
	setupApiRoute(router, 'get', '/tokens/:token', [...middlewares], controllers.write.admin.getToken);
	setupApiRoute(router, 'put', '/tokens/:token', [...middlewares], controllers.write.admin.updateToken);
	setupApiRoute(router, 'delete', '/tokens/:token', [...middlewares], controllers.write.admin.deleteToken);
	setupApiRoute(router, 'post', '/tokens/:token/roll', [...middlewares], controllers.write.admin.rollToken);

	setupApiRoute(router, 'delete', '/chats/:roomId', [...middlewares, middleware.assert.room], controllers.write.admin.chats.deleteRoom);

	setupApiRoute(router, 'get', '/groups', [...middlewares], controllers.write.admin.listGroups);

	setupApiRoute(router, 'post', '/activitypub/rules', [...middlewares, middleware.checkRequired.bind(null, ['value', 'type'])], controllers.write.admin.activitypub.addRule);
	setupApiRoute(router, 'delete', '/activitypub/rules/:rid', [...middlewares], controllers.write.admin.activitypub.deleteRule);
	setupApiRoute(router, 'put', '/activitypub/rules/order', [...middlewares, middleware.checkRequired.bind(null, ['rids'])], controllers.write.admin.activitypub.reorderRules);
	setupApiRoute(router, 'post', '/activitypub/relays', [...middlewares, middleware.checkRequired.bind(null, ['url'])], controllers.write.admin.activitypub.addRelay);
	setupApiRoute(router, 'delete', '/activitypub/relays/:url', [...middlewares], controllers.write.admin.activitypub.removeRelay);
	setupApiRoute(router, 'post', '/activitypub/blocklists', [...middlewares, middleware.checkRequired.bind(null, ['url'])], controllers.write.admin.activitypub.addBlocklist);
	setupApiRoute(router, 'post', '/activitypub/blocklists/core', [...middlewares], controllers.write.admin.activitypub.addCoreDomain);
	setupApiRoute(router, 'delete', '/activitypub/blocklists/core', [...middlewares], controllers.write.admin.activitypub.removeCoreDomain);
	setupApiRoute(router, 'get', '/activitypub/blocklists/:url', [...middlewares], controllers.write.admin.activitypub.viewBlocklist);
	setupApiRoute(router, 'delete', '/activitypub/blocklists/:url', [...middlewares], controllers.write.admin.activitypub.removeBlocklist);
	setupApiRoute(router, 'post', '/activitypub/blocklists/:url/refresh', [...middlewares], controllers.write.admin.activitypub.refreshBlocklist);

	setupApiRoute(router, 'post', '/plugins/:pluginId', [...middlewares, requireAPIReAuth], controllers.write.admin.plugins.install);
	setupApiRoute(router, 'delete', '/plugins/:pluginId', [...middlewares], controllers.write.admin.plugins.uninstall);
	setupApiRoute(router, 'put', '/plugins/:pluginId/active', [...middlewares, middleware.checkRequired.bind(null, ['active'])], controllers.write.admin.plugins.setActive);
	setupApiRoute(router, 'put', '/plugins/:pluginId/upgrade', [...middlewares], controllers.write.admin.plugins.upgrade);

	return router;
};
