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
const passport = require('passport');
const nconf_1 = __importDefault(require("nconf"));
const path_1 = __importDefault(require("path"));
const util = require('util');
const user_1 = __importDefault(require("../user"));
const privileges = require('../privileges');
const plugins = require('../plugins');
const helpers = require('./helpers').default;
const auth = require('../routes/authentication');
const writeRouter = require('../routes/write');
const controllers = {
    helpers: require('../controllers/helpers'),
    authentication: require('../controllers/authentication'),
};
const passportAuthenticateAsync = function (req, res) {
    return new Promise((resolve, reject) => {
        passport.authenticate('core.api', (err, user) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(user);
                res.on('finish', writeRouter.cleanup.bind(null, req));
            }
        }).default(req, res);
    });
};
function default_1(middleware) {
    function authenticate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            function finishLogin(req, user) {
                return __awaiter(this, void 0, void 0, function* () {
                    const loginAsync = util.promisify(req.login).bind(req);
                    yield loginAsync(user, { keepSessionInfo: true });
                    yield controllers.authentication.onSuccessfulLogin(req, user.uid);
                    req.uid = user.uid;
                    req.loggedIn = req.uid > 0;
                    return true;
                });
            }
            if (res.locals.isAPI && (req.loggedIn || !req.headers.hasOwnProperty('authorization'))) {
                // If authenticated via cookie (express-session), protect routes with CSRF checking
                yield middleware.applyCSRFasync(req, res);
            }
            if (req.loggedIn) {
                return true;
            }
            else if (req.headers.hasOwnProperty('authorization')) {
                const user = yield passportAuthenticateAsync(req, res);
                if (!user) {
                    return true;
                }
                if (user.hasOwnProperty('uid')) {
                    return yield finishLogin(req, user);
                }
                else if (user.hasOwnProperty('master') && user.master === true) {
                    // If the token received was a master token, a _uid must also be present for all calls
                    if (req.body.hasOwnProperty('_uid') || req.query.hasOwnProperty('_uid')) {
                        user.uid = req.body._uid || req.query._uid;
                        delete user.master;
                        return yield finishLogin(req, user);
                    }
                    throw new Error('[[error:api.master-token-no-uid]]');
                }
                else {
                    winston_1.default.warn('[api/authenticate] Unable to find user after verifying token');
                    return true;
                }
            }
            yield plugins.hooks.fire('response:middleware.authenticate', {
                req: req,
                res: res,
                next: function () { }, // no-op for backwards compatibility
            });
            if (!res.headersSent) {
                auth.setAuthVars(req);
            }
            return !res.headersSent;
        });
    }
    middleware.authenticateRequest = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const { skip } = yield plugins.hooks.fire('filter:middleware.authenticate', {
            skip: {
                // get: [],
                post: ['/api/v3/utilities/login'],
                // etc...
            },
        });
        const mountedPath = path_1.default.join(req.baseUrl, req.path).replace(nconf_1.default.get('relative_path'), '');
        const method = req.method.toLowerCase();
        if (skip[method] && skip[method].includes(mountedPath)) {
            return next();
        }
        if (!(yield authenticate(req, res))) {
            return;
        }
        next();
    }));
    middleware.ensureSelfOrGlobalPrivilege = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        yield ensureSelfOrMethod(user_1.default.isAdminOrGlobalMod, req, res, next);
    }));
    middleware.ensureSelfOrPrivileged = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        yield ensureSelfOrMethod(user_1.default.isPrivileged, req, res, next);
    }));
    function ensureSelfOrMethod(method, req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            /*
                The "self" part of this middleware hinges on you having used
                middleware.exposeUid prior to invoking this middleware.
            */
            if (!req.loggedIn) {
                return controllers.helpers.notAllowed(req, res);
            }
            if (req.uid === parseInt(res.locals.uid, 10)) {
                return next();
            }
            const allowed = yield method(req.uid);
            if (!allowed) {
                return controllers.helpers.notAllowed(req, res);
            }
            return next();
        });
    }
    middleware.canViewUsers = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        if (parseInt(res.locals.uid, 10) === req.uid) {
            return next();
        }
        const canView = yield privileges.global.can('view:users', req.uid);
        if (canView) {
            return next();
        }
        controllers.helpers.notAllowed(req, res);
    }));
    middleware.canViewGroups = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const canView = yield privileges.global.can('view:groups', req.uid);
        if (canView) {
            return next();
        }
        controllers.helpers.notAllowed(req, res);
    }));
    middleware.canChat = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const canChat = yield privileges.global.can('chat', req.uid);
        if (canChat) {
            return next();
        }
        controllers.helpers.notAllowed(req, res);
    }));
    middleware.checkAccountPermissions = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        // This middleware ensures that only the requested user and admins can pass
        // This check if left behind for legacy purposes. Older plugins may call this middleware without ensureLoggedIn
        if (!req.loggedIn) {
            return controllers.helpers.notAllowed(req, res);
        }
        if (!['uid', 'userslug'].some(param => req.params.hasOwnProperty(param))) {
            return controllers.helpers.notAllowed(req, res);
        }
        const uid = req.params.uid || (yield user_1.default.getUidByUserslug(req.params.userslug));
        let allowed = yield privileges.users.canEdit(req.uid, uid);
        if (allowed) {
            return next();
        }
        if (/user\/.+\/info$/.test(req.path)) {
            allowed = yield privileges.global.can('view:users:info', req.uid);
        }
        if (allowed) {
            return next();
        }
        controllers.helpers.notAllowed(req, res);
    }));
    middleware.redirectToAccountIfLoggedIn = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        if (req.session.forceLogin || req.uid <= 0) {
            return next();
        }
        const userslug = yield user_1.default.getUserField(req.uid, 'userslug');
        controllers.helpers.redirect(res, `/user/${userslug}`);
    }));
    middleware.redirectUidToUserslug = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const uid = parseInt(req.params.uid, 10);
        if (uid <= 0) {
            return next();
        }
        const userslug = yield user_1.default.getUserField(uid, 'userslug');
        if (!userslug) {
            return next();
        }
        const path = req.url.replace(/^\/api/, '')
            .replace(`/uid/${uid}`, () => `/user/${userslug}`);
        controllers.helpers.redirect(res, path);
    }));
    middleware.redirectMeToUserslug = helpers.try((req, res) => __awaiter(this, void 0, void 0, function* () {
        const userslug = yield user_1.default.getUserField(req.uid, 'userslug');
        if (!userslug) {
            return controllers.helpers.notAllowed(req, res);
        }
        const path = req.url.replace(/^(\/api)?\/me/, () => `/user/${userslug}`);
        controllers.helpers.redirect(res, path);
    }));
    middleware.requireUser = function (req, res, next) {
        if (req.loggedIn) {
            return next();
        }
        res.status(403).render('403', { title: '[[global:403.title]]' });
    };
    middleware.registrationComplete = function registrationComplete(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            // If the user's session contains registration data, redirect the user to complete registration
            if (!req.session.hasOwnProperty('registration')) {
                return setImmediate(next);
            }
            const path = req.path.startsWith('/api/') ? req.path.replace('/api', '') : req.path;
            const { allowed } = yield plugins.hooks.fire('filter:middleware.registrationComplete', {
                allowed: ['/register/complete'],
            });
            if (!allowed.includes(path)) {
                // Append user data if present
                req.session.registration.uid = req.session.registration.uid || req.uid;
                controllers.helpers.redirect(res, '/register/complete');
            }
            else {
                setImmediate(next);
            }
        });
    };
}
exports.default = default_1;
;
