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
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const express = require('express');
const chalk = require('chalk');
const meta_1 = __importDefault(require("../meta"));
const controllers = require('../controllers');
const controllerHelpers = require('../controllers/helpers');
const plugins = require('../plugins');
const authRoutes = require('./authentication');
const writeRoutes = require('./write');
const helpers = require('./helpers').defualt;
const { setupPageRoute } = helpers;
const _mounts = {
    user: require('./user'),
    meta: require('./meta'),
    api: require('./api'),
    admin: require('./admin'),
    feed: require('./feeds'),
};
_mounts.main = (app, middleware, controllers) => {
    const loginRegisterMiddleware = [middleware.redirectToAccountIfLoggedIn];
    setupPageRoute(app, '/login', loginRegisterMiddleware, controllers.login);
    setupPageRoute(app, '/register', loginRegisterMiddleware, controllers.register);
    setupPageRoute(app, '/register/complete', [], controllers.registerInterstitial);
    setupPageRoute(app, '/compose', [], controllers.composer.get);
    setupPageRoute(app, '/confirm/:code', [], controllers.confirmEmail);
    setupPageRoute(app, '/outgoing', [], controllers.outgoing);
    setupPageRoute(app, '/search', [], controllers.search.search);
    setupPageRoute(app, '/reset/:code?', [middleware.delayLoading], controllers.reset);
    setupPageRoute(app, '/tos', [], controllers.termsOfUse);
    setupPageRoute(app, '/email/unsubscribe/:token', [], controllers.accounts.settings.unsubscribe);
    app.post('/email/unsubscribe/:token', controllers.accounts.settings.unsubscribePost);
    app.post('/compose', middleware.applyCSRF, controllers.composer.post);
};
_mounts.mod = (app, middleware, controllers) => {
    setupPageRoute(app, '/flags', [], controllers.mods.flags.list);
    setupPageRoute(app, '/flags/:flagId', [], controllers.mods.flags.detail);
    setupPageRoute(app, '/post-queue/:id?', [], controllers.mods.postQueue);
};
_mounts.globalMod = (app, middleware, controllers) => {
    setupPageRoute(app, '/ip-blacklist', [], controllers.globalMods.ipBlacklist);
    setupPageRoute(app, '/registration-queue', [], controllers.globalMods.registrationQueue);
};
_mounts.topic = (app, name, middleware, controllers) => {
    setupPageRoute(app, `/${name}/:topic_id/:slug/:post_index?`, [], controllers.topics.get);
    setupPageRoute(app, `/${name}/:topic_id/:slug?`, [], controllers.topics.get);
};
_mounts.post = (app, name, middleware, controllers) => {
    const middlewares = [
        middleware.maintenanceMode,
        middleware.authenticateRequest,
        middleware.registrationComplete,
        middleware.pluginHooks,
    ];
    app.get(`/${name}/:pid`, middleware.busyCheck, middlewares, controllers.posts.redirectToPost);
    app.get(`/api/${name}/:pid`, middlewares, controllers.posts.redirectToPost);
};
_mounts.tags = (app, name, middleware, controllers) => {
    setupPageRoute(app, `/${name}/:tag`, [middleware.privateTagListing], controllers.tags.getTag);
    setupPageRoute(app, `/${name}`, [middleware.privateTagListing], controllers.tags.getTags);
};
_mounts.category = (app, name, middleware, controllers) => {
    setupPageRoute(app, '/categories', [], controllers.categories.list);
    setupPageRoute(app, '/popular', [], controllers.popular.get);
    setupPageRoute(app, '/recent', [], controllers.recent.get);
    setupPageRoute(app, '/top', [], controllers.top.get);
    setupPageRoute(app, '/unread', [middleware.ensureLoggedIn], controllers.unread.get);
    setupPageRoute(app, `/${name}/:category_id/:slug/:topic_index`, [], controllers.category.get);
    setupPageRoute(app, `/${name}/:category_id/:slug?`, [], controllers.category.get);
};
_mounts.users = (app, name, middleware, controllers) => {
    const middlewares = [middleware.canViewUsers];
    setupPageRoute(app, `/${name}`, middlewares, controllers.users.index);
};
_mounts.groups = (app, name, middleware, controllers) => {
    const middlewares = [middleware.canViewGroups];
    setupPageRoute(app, `/${name}`, middlewares, controllers.groups.list);
    setupPageRoute(app, `/${name}/:slug`, middlewares, controllers.groups.details);
    setupPageRoute(app, `/${name}/:slug/members`, middlewares, controllers.groups.members);
};
function default_1(app, middleware) {
    return __awaiter(this, void 0, void 0, function* () {
        const router = express.Router();
        router.render = function (...args) {
            app.render(...args);
        };
        // Allow plugins/themes to mount some routes elsewhere
        const remountable = ['admin', 'category', 'topic', 'post', 'users', 'user', 'groups', 'tags'];
        const { mounts } = yield plugins.hooks.fire('filter:router.add', {
            mounts: remountable.reduce((memo, mount) => {
                memo[mount] = mount;
                return memo;
            }, {}),
        });
        // Guard against plugins sending back missing/extra mounts
        Object.keys(mounts).forEach((mount) => {
            if (!remountable.includes(mount)) {
                delete mounts[mount];
            }
            else if (typeof mount !== 'string') {
                mounts[mount] = mount;
            }
        });
        remountable.forEach((mount) => {
            if (!mounts.hasOwnProperty(mount)) {
                mounts[mount] = mount;
            }
        });
        router.all('(/+api|/+api/*?)', middleware.prepareAPI);
        router.all(`(/+api/admin|/+api/admin/*?${mounts.admin !== 'admin' ? `|/+api/${mounts.admin}|/+api/${mounts.admin}/*?` : ''})`, middleware.authenticateRequest, middleware.ensureLoggedIn, middleware.admin.checkPrivileges);
        router.all(`(/+admin|/+admin/*?${mounts.admin !== 'admin' ? `|/+${mounts.admin}|/+${mounts.admin}/*?` : ''})`, middleware.ensureLoggedIn, middleware.applyCSRF, middleware.admin.checkPrivileges);
        app.use(middleware.stripLeadingSlashes);
        // handle custom homepage routes
        router.use('/', controllers.home.rewrite);
        // homepage handled by `action:homepage.get:[route]`
        setupPageRoute(router, '/', [], controllers.home.pluginHook);
        yield plugins.reloadRoutes({ router: router });
        yield authRoutes.reloadRoutes({ router: router });
        yield writeRoutes.reload({ router: router });
        addCoreRoutes(app, router, middleware, mounts);
        winston_1.default.info('[router] Routes added');
    });
}
exports.default = default_1;
;
function addCoreRoutes(app, router, middleware, mounts) {
    _mounts.meta(router, middleware, controllers);
    _mounts.api(router, middleware, controllers);
    _mounts.feed(router, middleware, controllers);
    _mounts.main(router, middleware, controllers);
    _mounts.mod(router, middleware, controllers);
    _mounts.globalMod(router, middleware, controllers);
    addRemountableRoutes(app, router, middleware, mounts);
    const relativePath = nconf_1.default.get('relative_path');
    app.use(relativePath || '/', router);
    if (process.env.NODE_ENV === 'development') {
        require('./debug').default(app, middleware, controllers);
    }
    app.use(middleware.privateUploads);
    const statics = [
        { route: '/assets', path: path_1.default.join(__dirname, '../../build/public') },
        { route: '/assets', path: path_1.default.join(__dirname, '../../../public') },
    ];
    const staticOptions = {
        maxAge: app.enabled('cache') ? 5184000000 : 0,
    };
    if (path_1.default.resolve(__dirname, '../../../public/uploads') !== nconf_1.default.get('upload_path')) {
        statics.unshift({ route: '/assets/uploads', path: nconf_1.default.get('upload_path') });
    }
    statics.forEach((obj) => {
        app.use(relativePath + obj.route, middleware.addUploadHeaders, express.static(obj.path, staticOptions));
    });
    app.use(`${relativePath}/uploads`, (req, res) => {
        res.redirect(`${relativePath}/assets/uploads${req.path}?${meta_1.default.config['cache-buster']}`);
    });
    app.use(`${relativePath}/plugins`, (req, res) => {
        winston_1.default.warn(`${chalk.bold.red('[deprecation]')} The \`/plugins\` shorthand prefix is deprecated, prefix with \`/assets/plugins\` instead (path: ${req.path})`);
        res.redirect(`${relativePath}/assets/plugins${req.path}${req._parsedUrl.search || ''}`);
    });
    // Skins
    meta_1.default.css.supportedSkins.forEach((skin) => {
        app.use(`${relativePath}/assets/client-${skin}.css`, middleware.buildSkinAsset);
        app.use(`${relativePath}/assets/client-${skin}-rtl.css`, middleware.buildSkinAsset);
    });
    app.use(controllers['404'].handle404);
    app.use(controllers.errors.handleURIErrors);
    app.use(controllers.errors.handleErrors);
}
function addRemountableRoutes(app, router, middleware, mounts) {
    Object.keys(mounts).map((mount) => __awaiter(this, void 0, void 0, function* () {
        const original = mount;
        mount = mounts[original];
        if (!mount) { // do not mount at all
            winston_1.default.warn(`[router] Not mounting /${original}`);
            return;
        }
        if (mount !== original) {
            // Set up redirect for fallback handling (some js/tpls may still refer to the traditional mount point)
            winston_1.default.info(`[router] /${original} prefix re-mounted to /${mount}. Requests to /${original}/* will now redirect to /${mount}`);
            router.use(new RegExp(`/(api/)?${original}`), (req, res) => {
                controllerHelpers.redirect(res, `${nconf_1.default.get('relative_path')}/${mount}${req.path}`);
            });
        }
        _mounts[original](router, mount, middleware, controllers);
    }));
}
