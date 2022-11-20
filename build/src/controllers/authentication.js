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
const validator = require('validator');
const _ = require('lodash');
const util = require('util');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const analytics = require('../analytics');
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const utils = require('../utils');
const slugify = require('../slugify');
const helpers = require('./helpers').defualt;
const privileges = require('../privileges');
const sockets = require('../socket.io');
const authenticationController = {};
function registerAndLoginUser(req, res, userData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!userData.hasOwnProperty('email')) {
            userData.updateEmail = true;
        }
        const data = yield user_1.default.interstitials.get(req, userData);
        // If interstitials are found, save registration attempt into session and abort
        const deferRegistration = data.interstitials.length;
        if (deferRegistration) {
            userData.register = true;
            req.session.registration = userData;
            if (req.body.noscript === 'true') {
                res.redirect(`${nconf_1.default.get('relative_path')}/register/complete`);
                return;
            }
            res.json({ next: `${nconf_1.default.get('relative_path')}/register/complete` });
            return;
        }
        const queue = yield user_1.default.shouldQueueUser(req.ip);
        const result = yield plugins.hooks.fire('filter:register.shouldQueue', { req: req, res: res, userData: userData, queue: queue });
        if (result.queue) {
            return yield addToApprovalQueue(req, userData);
        }
        const uid = yield user_1.default.create(userData);
        if (res.locals.processLogin) {
            yield authenticationController.doLogin(req, uid);
        }
        // Distinguish registrations through invites from direct ones
        if (userData.token) {
            // Token has to be verified at this point
            yield Promise.all([
                user_1.default.confirmIfInviteEmailIsUsed(userData.token, userData.email, uid),
                user_1.default.joinGroupsFromInvitation(uid, userData.token),
            ]);
        }
        yield user_1.default.deleteInvitationKey(userData.email, userData.token);
        const next = req.session.returnTo || `${nconf_1.default.get('relative_path')}/`;
        const complete = yield plugins.hooks.fire('filter:register.complete', { uid: uid, next: next });
        req.session.returnTo = complete.next;
        return complete;
    });
}
authenticationController.register = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const registrationType = meta_1.default.config.registrationType || 'normal';
        if (registrationType === 'disabled') {
            return res.sendStatus(403);
        }
        const userData = req.body;
        try {
            if (userData.token || registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
                yield user_1.default.verifyInvitation(userData);
            }
            if (!userData.username ||
                userData.username.length < meta_1.default.config.minimumUsernameLength ||
                slugify(userData.username).length < meta_1.default.config.minimumUsernameLength) {
                throw new Error('[[error:username-too-short]]');
            }
            if (userData.username.length > meta_1.default.config.maximumUsernameLength) {
                throw new Error('[[error:username-too-long]]');
            }
            if (userData.password !== userData['password-confirm']) {
                throw new Error('[[user:change_password_error_match]]');
            }
            if (userData.password.length > 512) {
                throw new Error('[[error:password-too-long]]');
            }
            user_1.default.isPasswordValid(userData.password);
            res.locals.processLogin = true; // set it to false in plugin if you wish to just register only
            yield plugins.hooks.fire('filter:register.check', { req: req, res: res, userData: userData });
            const data = yield registerAndLoginUser(req, res, userData);
            if (data) {
                if (data.uid && req.body.userLang) {
                    yield user_1.default.setSetting(data.uid, 'userLang', req.body.userLang);
                }
                res.json(data);
            }
        }
        catch (err) {
            helpers.noScriptErrors(req, res, err.message, 400);
        }
    });
};
function addToApprovalQueue(req, userData) {
    return __awaiter(this, void 0, void 0, function* () {
        userData.ip = req.ip;
        yield user_1.default.addToApprovalQueue(userData);
        let message = '[[register:registration-added-to-queue]]';
        if (meta_1.default.config.showAverageApprovalTime) {
            const average_time = yield database_1.default.getObjectField('registration:queue:approval:times', 'average');
            if (average_time > 0) {
                message += ` [[register:registration-queue-average-time, ${Math.floor(average_time / 60)}, ${Math.floor(average_time % 60)}]]`;
            }
        }
        if (meta_1.default.config.autoApproveTime > 0) {
            message += ` [[register:registration-queue-auto-approve-time, ${meta_1.default.config.autoApproveTime}]]`;
        }
        return { message: message };
    });
}
authenticationController.registerComplete = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // For the interstitials that respond, execute the callback with the form body
            const data = yield user_1.default.interstitials.get(req, req.session.registration);
            const callbacks = data.interstitials.reduce((memo, cur) => {
                if (cur.hasOwnProperty('callback') && typeof cur.callback === 'function') {
                    req.body.files = req.files;
                    if ((cur.callback.constructor && cur.callback.constructor.name === 'AsyncFunction') ||
                        cur.callback.length === 2 // non-async function w/o callback
                    ) {
                        memo.push(cur.callback);
                    }
                    else {
                        memo.push(util.promisify(cur.callback));
                    }
                }
                return memo;
            }, []);
            const done = function (data) {
                delete req.session.registration;
                const relative_path = nconf_1.default.get('relative_path');
                if (data && data.message) {
                    return res.redirect(`${relative_path}/?register=${encodeURIComponent(data.message)}`);
                }
                if (req.session.returnTo) {
                    res.redirect(relative_path + req.session.returnTo.replace(new RegExp(`^${relative_path}`), ''));
                }
                else {
                    res.redirect(`${relative_path}/`);
                }
            };
            const results = yield Promise.allSettled(callbacks.map((cb) => __awaiter(this, void 0, void 0, function* () {
                yield cb(req.session.registration, req.body);
            })));
            const errors = results.map((result) => result.status === 'rejected' && result.reason && result.reason.message).filter(Boolean);
            if (errors.length) {
                req.flash('errors', errors);
                return req.session.save(() => {
                    res.redirect(`${nconf_1.default.get('relative_path')}/register/complete`);
                });
            }
            if (req.session.registration.register === true) {
                res.locals.processLogin = true;
                req.body.noscript = 'true'; // trigger full page load on error
                const data = yield registerAndLoginUser(req, res, req.session.registration);
                if (!data) {
                    return winston_1.default.warn('[register] Interstitial callbacks processed with no errors, but one or more interstitials remain. This is likely an issue with one of the interstitials not properly handling a null case or invalid value.');
                }
                done(data);
            }
            else {
                // Update user hash, clear registration data in session
                const payload = req.session.registration;
                const { uid } = payload;
                delete payload.uid;
                delete payload.returnTo;
                Object.keys(payload).forEach((prop) => {
                    if (typeof payload[prop] === 'boolean') {
                        payload[prop] = payload[prop] ? 1 : 0;
                    }
                });
                yield user_1.default.setUserFields(uid, payload);
                done();
            }
        }
        catch (err) {
            delete req.session.registration;
            res.redirect(`${nconf_1.default.get('relative_path')}/?register=${encodeURIComponent(err.message)}`);
        }
    });
};
authenticationController.registerAbort = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.uid) {
        // Email is the only cancelable interstitial
        delete req.session.registration.updateEmail;
        const { interstitials } = yield user_1.default.interstitials.get(req, req.session.registration);
        if (!interstitials.length) {
            return res.redirect(nconf_1.default.get('relative_path') + (req.session.returnTo || '/'));
        }
    }
    // End the session and redirect to home
    req.session.destroy(() => {
        res.clearCookie(nconf_1.default.get('sessionKey'), meta_1.default.configs.cookie.get());
        res.redirect(`${nconf_1.default.get('relative_path')}/`);
    });
});
authenticationController.login = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    let { strategy } = yield plugins.hooks.fire('filter:login.override', { req, strategy: 'local' });
    if (!passport._strategy(strategy)) {
        winston_1.default.error(`[auth/override] Requested login strategy "${strategy}" not found, reverting back to local login strategy.`);
        strategy = 'local';
    }
    if (plugins.hooks.hasListeners('action:auth.overrideLogin')) {
        return continueLogin(strategy, req, res, next);
    }
    const loginWith = meta_1.default.config.allowLoginWith || 'username-email';
    req.body.username = String(req.body.username).trim();
    const errorHandler = res.locals.noScriptErrors || helpers.noScriptErrors;
    try {
        yield plugins.hooks.fire('filter:login.check', { req: req, res: res, userData: req.body });
    }
    catch (err) {
        return errorHandler(req, res, err.message, 403);
    }
    try {
        const isEmailLogin = loginWith.includes('email') && req.body.username && utils.isEmailValid(req.body.username);
        const isUsernameLogin = loginWith.includes('username') && !validator.isEmail(req.body.username);
        if (isEmailLogin) {
            const username = yield user_1.default.getUsernameByEmail(req.body.username);
            if (username !== '[[global:guest]]') {
                req.body.username = username;
            }
        }
        if (isEmailLogin || isUsernameLogin) {
            continueLogin(strategy, req, res, next);
        }
        else {
            errorHandler(req, res, `[[error:wrong-login-type-${loginWith}]]`, 400);
        }
    }
    catch (err) {
        return errorHandler(req, res, err.message, 500);
    }
});
function continueLogin(strategy, req, res, next) {
    passport.authenticate(strategy, (err, userData, info) => __awaiter(this, void 0, void 0, function* () {
        if (err) {
            plugins.hooks.fire('action:login.continue', { req, strategy, userData, error: err });
            return helpers.noScriptErrors(req, res, err.data || err.message, 403);
        }
        if (!userData) {
            if (info instanceof Error) {
                info = info.message;
            }
            else if (typeof info === 'object') {
                info = '[[error:invalid-username-or-password]]';
            }
            plugins.hooks.fire('action:login.continue', { req, strategy, userData, error: new Error(info) });
            return helpers.noScriptErrors(req, res, info, 403);
        }
        // Alter user cookie depending on passed-in option
        if (req.body.remember === 'on') {
            const duration = meta_1.default.getSessionTTLSeconds() * 1000;
            req.session.cookie.maxAge = duration;
            req.session.cookie.expires = new Date(Date.now() + duration);
        }
        else {
            req.session.cookie.maxAge = false;
            req.session.cookie.expires = false;
        }
        plugins.hooks.fire('action:login.continue', { req, strategy, userData, error: null });
        if (userData.passwordExpiry && userData.passwordExpiry < Date.now()) {
            winston_1.default.verbose(`[auth] Triggering password reset for uid ${userData.uid} due to password policy`);
            req.session.passwordExpired = true;
            const code = yield user_1.default.reset.generate(userData.uid);
            (res.locals.redirectAfterLogin || redirectAfterLogin).default(req, res, `${nconf_1.default.get('relative_path')}/reset/${code}`);
        }
        else {
            delete req.query.lang;
            yield authenticationController.doLogin(req, userData.uid);
            let destination;
            if (req.session.returnTo) {
                destination = req.session.returnTo.startsWith('http') ?
                    req.session.returnTo :
                    nconf_1.default.get('relative_path') + req.session.returnTo;
                delete req.session.returnTo;
            }
            else {
                destination = `${nconf_1.default.get('relative_path')}/`;
            }
            (res.locals.redirectAfterLogin || redirectAfterLogin).default(req, res, destination);
        }
    })).default(req, res, next);
}
function redirectAfterLogin(req, res, destination) {
    if (req.body.noscript === 'true') {
        res.redirect(`${destination}?loggedin`);
    }
    else {
        res.status(200).send({
            next: destination,
        });
    }
}
authenticationController.doLogin = function (req, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!uid) {
            return;
        }
        const loginAsync = util.promisify(req.login).bind(req);
        yield loginAsync({ uid: uid }, { keepSessionInfo: req.res.locals !== false });
        yield authenticationController.onSuccessfulLogin(req, uid);
    });
};
authenticationController.onSuccessfulLogin = function (req, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        /*
         * Older code required that this method be called from within the SSO plugin.
         * That behaviour is no longer required, onSuccessfulLogin is now automatically
         * called in NodeBB core. However, if already called, return prematurely
         */
        if (req.loggedIn && !req.session.forceLogin) {
            return true;
        }
        try {
            const uuid = utils.generateUUID();
            req.uid = uid;
            req.loggedIn = true;
            yield meta_1.default.blacklist.test(req.ip);
            yield user_1.default.logIP(uid, req.ip);
            yield user_1.default.bans.unbanIfExpired([uid]);
            yield user_1.default.reset.cleanByUid(uid);
            req.session.meta = {};
            delete req.session.forceLogin;
            // Associate IP used during login with user account
            req.session.meta.ip = req.ip;
            // Associate metadata retrieved via user-agent
            req.session.meta = _.extend(req.session.meta, {
                uuid: uuid,
                datetime: Date.now(),
                platform: req.useragent.platform,
                browser: req.useragent.browser,
                version: req.useragent.version,
            });
            yield Promise.all([
                new Promise((resolve) => {
                    req.session.save(resolve);
                }),
                user_1.default.auth.addSession(uid, req.sessionID),
                user_1.default.updateLastOnlineTime(uid),
                user_1.default.updateOnlineUsers(uid),
                analytics.increment('logins'),
                database_1.default.incrObjectFieldBy('global', 'loginCount', 1),
            ]);
            if (uid > 0) {
                yield database_1.default.setObjectField(`uid:${uid}:sessionUUID:sessionId`, uuid, req.sessionID);
            }
            // Force session check for all connected socket.io clients with the same session id
            sockets.in(`sess_${req.sessionID}`).emit('checkSession', uid);
            plugins.hooks.fire('action:user.loggedIn', { uid: uid, req: req });
        }
        catch (err) {
            req.session.destroy();
            throw err;
        }
    });
};
authenticationController.localLogin = function (req, username, password, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!username) {
            return next(new Error('[[error:invalid-username]]'));
        }
        if (!password || !utils.isPasswordValid(password)) {
            return next(new Error('[[error:invalid-password]]'));
        }
        if (password.length > 512) {
            return next(new Error('[[error:password-too-long]]'));
        }
        const userslug = slugify(username);
        const uid = yield user_1.default.getUidByUserslug(userslug);
        try {
            const [userData, isAdminOrGlobalMod, canLoginIfBanned] = yield Promise.all([
                user_1.default.getUserFields(uid, ['uid', 'passwordExpiry']),
                user_1.default.isAdminOrGlobalMod(uid),
                user_1.default.bans.canLoginIfBanned(uid),
            ]);
            userData.isAdminOrGlobalMod = isAdminOrGlobalMod;
            if (!canLoginIfBanned) {
                return next(yield getBanError(uid));
            }
            // Doing this after the ban check, because user's privileges might change after a ban expires
            const hasLoginPrivilege = yield privileges.global.can('local:login', uid);
            if (parseInt(uid, 10) && !hasLoginPrivilege) {
                return next(new Error('[[error:local-login-disabled]]'));
            }
            const passwordMatch = yield user_1.default.isPasswordCorrect(uid, password, req.ip);
            if (!passwordMatch) {
                return next(new Error('[[error:invalid-login-credentials]]'));
            }
            next(null, userData, '[[success:authentication-successful]]');
        }
        catch (err) {
            next(err);
        }
    });
};
const destroyAsync = util.promisify((req, callback) => req.session.destroy(callback));
const logoutAsync = util.promisify((req, callback) => req.logout(callback));
authenticationController.logout = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.loggedIn || !req.sessionID) {
            res.clearCookie(nconf_1.default.get('sessionKey'), meta_1.default.configs.cookie.get());
            return res.status(200).send('not-logged-in');
        }
        const { uid } = req;
        const { sessionID } = req;
        try {
            yield user_1.default.auth.revokeSession(sessionID, uid);
            yield logoutAsync(req);
            yield destroyAsync(req);
            res.clearCookie(nconf_1.default.get('sessionKey'), meta_1.default.configs.cookie.get());
            yield user_1.default.setUserField(uid, 'lastonline', Date.now() - (meta_1.default.config.onlineCutoff * 60000));
            yield database_1.default.sortedSetAdd('users:online', Date.now() - (meta_1.default.config.onlineCutoff * 60000), uid);
            yield plugins.hooks.fire('static:user.loggedOut', { req: req, res: res, uid: uid, sessionID: sessionID });
            // Force session check for all connected socket.io clients with the same session id
            sockets.in(`sess_${sessionID}`).emit('checkSession', 0);
            const payload = {
                next: `${nconf_1.default.get('relative_path')}/`,
            };
            plugins.hooks.fire('filter:user.logout', payload);
            if (req.body.noscript === 'true') {
                return res.redirect(payload.next);
            }
            res.status(200).send(payload);
        }
        catch (err) {
            next(err);
        }
    });
};
function getBanError(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const banInfo = yield user_1.default.getLatestBanInfo(uid);
            if (!banInfo.reason) {
                banInfo.reason = '[[user:info.banned-no-reason]]';
            }
            const err = new Error(banInfo.reason);
            err.data = banInfo;
            return err;
        }
        catch (err) {
            if (err.message === 'no-ban-info') {
                return new Error('[[error:user-banned]]');
            }
            throw err;
        }
    });
}
require('../promisify').promisify(authenticationController, ['register', 'registerComplete', 'registerAbort', 'login', 'localLogin', 'logout']);
