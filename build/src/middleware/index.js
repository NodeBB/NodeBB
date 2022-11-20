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
const async = require('async');
const path_1 = __importDefault(require("path"));
const csrf = require('csurf');
const validator = require('validator');
const nconf_1 = __importDefault(require("nconf"));
const toobusy = require('toobusy-js');
const util = require('util');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const groups = require('../groups');
const analytics = require('../analytics');
const privileges = require('../privileges');
const cacheCreate = require('../cache/lru').default;
const helpers = require('./helpers').defualt;
const controllers = {
    api: require('../controllers/api'),
    helpers: require('../controllers/helpers'),
};
const delayCache = cacheCreate({
    ttl: 1000 * 60,
    max: 200,
});
const middleware = {};
const relative_path = nconf_1.default.get('relative_path');
middleware.regexes = {
    timestampedUpload: /^\d+-.+$/,
};
const csrfMiddleware = csrf();
middleware.applyCSRF = function (req, res, next) {
    if (req.uid >= 0) {
        csrfMiddleware(req, res, next);
    }
    else {
        next();
    }
};
middleware.applyCSRFasync = util.promisify(middleware.applyCSRF);
middleware.ensureLoggedIn = (req, res, next) => {
    if (!req.loggedIn) {
        return controllers.helpers.notAllowed(req, res);
    }
    setImmediate(next);
};
Object.assign(middleware, Object.assign({ admin: require('./admin') }, require('./header')));
require('./render').default(middleware);
require('./maintenance').default(middleware);
require('./user').default(middleware);
middleware.uploads = require('./uploads');
require('./headers').default(middleware);
require('./expose').default(middleware);
middleware.assert = require('./assert');
middleware.stripLeadingSlashes = function stripLeadingSlashes(req, res, next) {
    const target = req.originalUrl.replace(relative_path, '');
    if (target.startsWith('//')) {
        return res.redirect(relative_path + target.replace(/^\/+/, '/'));
    }
    next();
};
middleware.pageView = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.loggedIn) {
        yield Promise.all([
            user_1.default.updateOnlineUsers(req.uid),
            user_1.default.updateLastOnlineTime(req.uid),
        ]);
    }
    next();
    yield analytics.pageView({ ip: req.ip, uid: req.uid });
    plugins.hooks.fire('action:middleware.pageView', { req: req });
}));
middleware.pluginHooks = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO: Deprecate in v2.0
    yield async.each(plugins.loadedHooks['filter:router.page'] || [], (hookObj, next) => {
        hookObj.method(req, res, next);
    });
    yield plugins.hooks.fire('response:router.page', {
        req: req,
        res: res,
    });
    if (!res.headersSent) {
        next();
    }
}));
middleware.validateFiles = function validateFiles(req, res, next) {
    if (!Array.isArray(req.files.files) || !req.files.files.length) {
        return next(new Error(['[[error:invalid-files]]']));
    }
    next();
};
middleware.prepareAPI = function prepareAPI(req, res, next) {
    res.locals.isAPI = true;
    next();
};
middleware.routeTouchIcon = function routeTouchIcon(req, res) {
    if (meta_1.default.config['brand:touchIcon'] && validator.isURL(meta_1.default.config['brand:touchIcon'])) {
        return res.redirect(meta_1.default.config['brand:touchIcon']);
    }
    let iconPath = '';
    if (meta_1.default.config['brand:touchIcon']) {
        iconPath = path_1.default.join(nconf_1.default.get('upload_path'), meta_1.default.config['brand:touchIcon'].replace(/assets\/uploads/, ''));
    }
    else {
        iconPath = path_1.default.join(nconf_1.default.get('base_dir'), 'public/images/touch/512.png');
    }
    return res.sendFile(iconPath, {
        maxAge: req.app.enabled('cache') ? 5184000000 : 0,
    });
};
middleware.privateTagListing = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const canView = yield privileges.global.can('view:tags', req.uid);
    if (!canView) {
        return controllers.helpers.notAllowed(req, res);
    }
    next();
}));
middleware.exposeGroupName = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield expose('groupName', groups.getGroupNameByGroupSlug, 'slug', req, res, next);
}));
middleware.exposeUid = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield expose('uid', user_1.default.getUidByUserslug, 'userslug', req, res, next);
}));
function expose(exposedField, method, field, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.params.hasOwnProperty(field)) {
            return next();
        }
        res.locals[exposedField] = yield method(req.params[field]);
        next();
    });
}
middleware.privateUploads = function privateUploads(req, res, next) {
    if (req.loggedIn || !meta_1.default.config.privateUploads) {
        return next();
    }
    if (req.path.startsWith(`${nconf_1.default.get('relative_path')}/assets/uploads/files`)) {
        const extensions = (meta_1.default.config.privateUploadsExtensions || '').split(',').filter(Boolean);
        let ext = path_1.default.extname(req.path);
        ext = ext ? ext.replace(/^\./, '') : ext;
        if (!extensions.length || extensions.includes(ext)) {
            return res.status(403).json('not-allowed');
        }
    }
    next();
};
middleware.busyCheck = function busyCheck(req, res, next) {
    if (global.env === 'production' && meta_1.default.config.eventLoopCheckEnabled && toobusy()) {
        analytics.increment('errors:503');
        res.status(503).type('text/html').sendFile(path_1.default.join(__dirname, '../../../public/503.html'));
    }
    else {
        setImmediate(next);
    }
};
middleware.applyBlacklist = function applyBlacklist(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield meta_1.default.blacklist.test(req.ip);
            next();
        }
        catch (err) {
            next(err);
        }
    });
};
middleware.delayLoading = function delayLoading(req, res, next) {
    // Introduces an artificial delay during load so that brute force attacks are effectively mitigated
    // Add IP to cache so if too many requests are made, subsequent requests are blocked for a minute
    let timesSeen = delayCache.get(req.ip) || 0;
    if (timesSeen > 10) {
        return res.sendStatus(429);
    }
    delayCache.set(req.ip, timesSeen += 1);
    setTimeout(next, 1000);
};
middleware.buildSkinAsset = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // If this middleware is reached, a skin was requested, so it is built on-demand
    const target = path_1.default.basename(req.originalUrl).match(/(client-[a-z]+)/);
    if (!target) {
        return next();
    }
    yield plugins.prepareForBuild(['client side styles']);
    const [ltr, rtl] = yield meta_1.default.css.buildBundle(target[0], true);
    require('../meta/minifier').killAll();
    res.status(200).type('text/css').send(req.originalUrl.includes('-rtl') ? rtl : ltr);
}));
middleware.addUploadHeaders = function addUploadHeaders(req, res, next) {
    // Trim uploaded files' timestamps when downloading + force download if html
    let basename = path_1.default.basename(req.path);
    const extname = path_1.default.extname(req.path);
    if (req.path.startsWith('/uploads/files/') && middleware.regexes.timestampedUpload.test(basename)) {
        basename = basename.slice(14);
        res.header('Content-Disposition', `${extname.startsWith('.htm') ? 'attachment' : 'inline'}; filename="${basename}"`);
    }
    next();
};
middleware.validateAuth = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield plugins.hooks.fire('static:auth.validate', {
            user: res.locals.user,
            strategy: res.locals.strategy,
        });
        next();
    }
    catch (err) {
        const regenerateSession = util.promisify(cb => req.session.regenerate(cb));
        yield regenerateSession();
        req.uid = 0;
        req.loggedIn = false;
        next(err);
    }
}));
middleware.checkRequired = function (fields, req, res, next) {
    // Used in API calls to ensure that necessary parameters/data values are present
    const missing = fields.filter(field => !req.body.hasOwnProperty(field));
    if (!missing.length) {
        return next();
    }
    controllers.helpers.formatApiResponse(400, res, new Error(`[[error:required-parameters-missing, ${missing.join(' ')}]]`));
};
