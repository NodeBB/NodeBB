'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const meta_1 = __importDefault(require("../../meta"));
const plugins = require('../../plugins');
const middleware = require('../../middleware');
const writeControllers = require('../../controllers/write');
const helpers = require('../../controllers/helpers');
const Write = {};
Write.reload = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { router } = params;
    let apiSettings = yield meta_1.default.settings.get('core.api');
    plugins.hooks.register('core', {
        hook: 'action:settings.set',
        method: (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (data.plugin === 'core.api') {
                apiSettings = yield meta_1.default.settings.get('core.api');
            }
        }),
    });
    router.use('/api/v3', (req, res, next) => {
        // Require https if configured so
        if (apiSettings.requireHttps === 'on' && req.protocol !== 'https') {
            res.set('Upgrade', 'TLS/1.0, HTTP/1.1');
            return helpers.formatApiResponse(426, res);
        }
        res.locals.isAPI = true;
        next();
    });
    router.use('/api/v3/users', require('./users').default());
    router.use('/api/v3/groups', require('./groups').default());
    router.use('/api/v3/categories', require('./categories').default());
    router.use('/api/v3/topics', require('./topics').default());
    router.use('/api/v3/posts', require('./posts').default());
    router.use('/api/v3/chats', require('./chats').default());
    router.use('/api/v3/flags', require('./flags').default());
    router.use('/api/v3/admin', require('./admin').default());
    router.use('/api/v3/files', require('./files').default());
    router.use('/api/v3/utilities', require('./utilities').default());
    router.get('/api/v3/ping', writeControllers.utilities.ping.get);
    router.post('/api/v3/ping', middleware.authenticateRequest, middleware.ensureLoggedIn, writeControllers.utilities.ping.post);
    /**
     * Plugins can add routes to the Write API by attaching a listener to the
     * below hook. The hooks added to the passed-in router will be mounted to
     * `/api/v3/plugins`.
     */
    const pluginRouter = require('express').Router();
    yield plugins.hooks.fire('static:api.routes', {
        router: pluginRouter,
        middleware,
        helpers,
    });
    winston_1.default.info(`[api] Adding ${pluginRouter.stack.length} route(s) to \`api/v3/plugins\``);
    router.use('/api/v3/plugins', pluginRouter);
    // 404 handling
    router.use('/api/v3', (req, res) => {
        helpers.formatApiResponse(404, res);
    });
});
Write.cleanup = (req) => {
    if (req && req.session) {
        req.session.destroy();
    }
};
