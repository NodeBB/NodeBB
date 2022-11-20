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
const jsesc = require('jsesc');
const nconf_1 = __importDefault(require("nconf"));
const semver = require('semver');
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const privileges = require('../privileges');
const utils = require('../utils');
const versions = require('../admin/versions');
const helpers = require('./helpers').default;
const controllers = {
    api: require('../controllers/api'),
    helpers: require('../controllers/helpers'),
};
const middleware = {};
middleware.buildHeader = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    res.locals.renderAdminHeader = true;
    if (req.method === 'GET') {
        yield require('./index').applyCSRFasync(req, res);
    }
    res.locals.config = yield controllers.api.loadConfig(req);
    next();
}));
middleware.renderHeader = (req, res, data) => __awaiter(void 0, void 0, void 0, function* () {
    const custom_header = {
        plugins: [],
        authentication: [],
    };
    res.locals.config = res.locals.config || {};
    const results = yield utils.promiseParallel({
        userData: user_1.default.getUserFields(req.uid, ['username', 'userslug', 'email', 'picture', 'email:confirmed']),
        scripts: getAdminScripts(),
        custom_header: plugins.hooks.fire('filter:admin.header.build', custom_header),
        configs: meta_1.default.configs.list(),
        latestVersion: getLatestVersion(),
        privileges: privileges.admin.get(req.uid),
        tags: meta_1.default.tags.parse(req, {}, [], []),
    });
    const { userData } = results;
    userData.uid = req.uid;
    userData['email:confirmed'] = userData['email:confirmed'] === 1;
    userData.privileges = results.privileges;
    let acpPath = req.path.slice(1).split('/');
    acpPath.forEach((path, i) => {
        acpPath[i] = path.charAt(0).toUpperCase() + path.slice(1);
    });
    acpPath = acpPath.join(' > ');
    const version = nconf_1.default.get('version');
    res.locals.config.userLang = res.locals.config.acpLang || res.locals.config.userLang;
    let templateValues = {
        config: res.locals.config,
        configJSON: jsesc(JSON.stringify(res.locals.config), { isScriptContext: true }),
        relative_path: res.locals.config.relative_path,
        adminConfigJSON: encodeURIComponent(JSON.stringify(results.configs)),
        metaTags: results.tags.meta,
        linkTags: results.tags.link,
        user: userData,
        userJSON: jsesc(JSON.stringify(userData), { isScriptContext: true }),
        plugins: results.custom_header.plugins,
        authentication: results.custom_header.authentication,
        scripts: results.scripts,
        'cache-buster': meta_1.default.config['cache-buster'] || '',
        env: !!process.env.NODE_ENV,
        title: `${acpPath || 'Dashboard'} | NodeBB Admin Control Panel`,
        bodyClass: data.bodyClass,
        version: version,
        latestVersion: results.latestVersion,
        upgradeAvailable: results.latestVersion && semver.gt(results.latestVersion, version),
        showManageMenu: results.privileges.superadmin || ['categories', 'privileges', 'users', 'admins-mods', 'groups', 'tags', 'settings'].some(priv => results.privileges[`admin:${priv}`]),
    };
    templateValues.template = { name: res.locals.template };
    templateValues.template[res.locals.template] = true;
    ({ templateData: templateValues } = yield plugins.hooks.fire('filter:middleware.renderAdminHeader', {
        req,
        res,
        templateData: templateValues,
        data,
    }));
    return yield req.app.renderAsync('admin/header', templateValues);
});
function getAdminScripts() {
    return __awaiter(this, void 0, void 0, function* () {
        const scripts = yield plugins.hooks.fire('filter:admin.scripts.get', []);
        return scripts.map(script => ({ src: script }));
    });
}
function getLatestVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield versions.getLatestVersion();
            return result;
        }
        catch (err) {
            winston_1.default.error(`[acp] Failed to fetch latest version${err.stack}`);
        }
        return null;
    });
}
middleware.renderFooter = function (req, res, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield req.app.renderAsync('admin/footer', data);
    });
};
middleware.checkPrivileges = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Kick out guests, obviously
    if (req.uid <= 0) {
        return controllers.helpers.notAllowed(req, res);
    }
    // Otherwise, check for privilege based on page (if not in mapping, deny access)
    const path = req.path.replace(/^(\/api)?(\/v3)?\/admin\/?/g, '');
    if (path) {
        const privilege = privileges.admin.resolve(path);
        if (!(yield privileges.admin.can(privilege, req.uid))) {
            return controllers.helpers.notAllowed(req, res);
        }
    }
    else {
        // If accessing /admin, check for any valid admin privs
        const privilegeSet = yield privileges.admin.get(req.uid);
        if (!Object.values(privilegeSet).some(Boolean)) {
            return controllers.helpers.notAllowed(req, res);
        }
    }
    // If user does not have password
    const hasPassword = yield user_1.default.hasPassword(req.uid);
    if (!hasPassword) {
        return next();
    }
    // Reject if they need to re-login (due to ACP timeout), otherwise extend logout timer
    const loginTime = req.session.meta ? req.session.meta.datetime : 0;
    const adminReloginDuration = meta_1.default.config.adminReloginDuration * 60000;
    const disabled = meta_1.default.config.adminReloginDuration === 0;
    if (disabled || (loginTime && parseInt(loginTime, 10) > Date.now() - adminReloginDuration)) {
        const timeLeft = parseInt(loginTime, 10) - (Date.now() - adminReloginDuration);
        if (req.session.meta && timeLeft < Math.min(60000, adminReloginDuration)) {
            req.session.meta.datetime += Math.min(60000, adminReloginDuration);
        }
        return next();
    }
    let returnTo = req.path;
    if (nconf_1.default.get('relative_path')) {
        returnTo = req.path.replace(new RegExp(`^${nconf_1.default.get('relative_path')}`), '');
    }
    returnTo = returnTo.replace(/^\/api/, '');
    req.session.returnTo = returnTo;
    req.session.forceLogin = 1;
    yield plugins.hooks.fire('response:auth.relogin', { req, res });
    if (res.headersSent) {
        return;
    }
    if (res.locals.isAPI) {
        res.status(401).json({});
    }
    else {
        res.redirect(`${nconf_1.default.get('relative_path')}/login?local=1`);
    }
}));
