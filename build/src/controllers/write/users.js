'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const util = require('util');
const nconf_1 = __importDefault(require("nconf"));
const path_1 = __importDefault(require("path"));
const crypto = require('crypto');
const fs = require('fs').promises;
const database = __importStar(require("../../database"));
const db = database;
const api = require('../../api');
const groups = require('../../groups');
const meta_1 = __importDefault(require("../../meta"));
const privileges = require('../../privileges');
const user_1 = __importDefault(require("../../user"));
const utils = require('../../utils');
const helpers_1 = __importDefault(require("../helpers"));
const Users = {};
const exportMetadata = new Map([
    ['posts', ['csv', 'text/csv']],
    ['uploads', ['zip', 'application/zip']],
    ['profile', ['json', 'application/json']],
]);
const hasAdminPrivilege = (uid, privilege) => __awaiter(void 0, void 0, void 0, function* () {
    const ok = yield privileges.admin.can(`admin:${privilege}`, uid);
    if (!ok) {
        throw new Error('[[error:no-privileges]]');
    }
});
Users.redirectBySlug = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const uid = yield user_1.default.getUidByUserslug(req.params.userslug);
    if (uid) {
        const path = req.path.split('/').slice(3).join('/');
        const urlObj = new URL(nconf_1.default.get('url') + req.url);
        res.redirect(308, nconf_1.default.get('relative_path') + encodeURI(`/api/v3/users/${uid}/${path}${urlObj.search}`));
    }
    else {
        helpers_1.default.formatApiResponse(404, res);
    }
});
Users.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield hasAdminPrivilege(req.uid, 'users');
    const userObj = yield api.users.create(req, req.body);
    helpers_1.default.formatApiResponse(200, res, userObj);
});
Users.exists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res);
});
Users.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield user_1.default.getUserData(req.params.uid);
    const publicUserData = yield user_1.default.hidePrivateData(userData, req.uid);
    helpers_1.default.formatApiResponse(200, res, publicUserData);
});
Users.update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userObj = yield api.users.update(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res, userObj);
});
Users.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.delete(req, Object.assign(Object.assign({}, req.params), { password: req.body.password }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.deleteContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.deleteContent(req, Object.assign(Object.assign({}, req.params), { password: req.body.password }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.deleteAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.deleteAccount(req, Object.assign(Object.assign({}, req.params), { password: req.body.password }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.deleteMany = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield hasAdminPrivilege(req.uid, 'users');
    yield api.users.deleteMany(req, req.body);
    helpers_1.default.formatApiResponse(200, res);
});
Users.changePicture = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.changePicture(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.updateSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const settings = yield api.users.updateSettings(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res, settings);
});
Users.changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.changePassword(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.follow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.follow(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Users.unfollow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.unfollow(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Users.ban = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.ban(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.unban = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.unban(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.mute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.mute(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.unmute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.unmute(req, Object.assign(Object.assign({}, req.body), { uid: req.params.uid }));
    helpers_1.default.formatApiResponse(200, res);
});
Users.generateToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield hasAdminPrivilege(req.uid, 'settings');
    if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
        return helpers_1.default.formatApiResponse(401, res);
    }
    const settings = yield meta_1.default.settings.get('core.api');
    settings.tokens = settings.tokens || [];
    const newToken = {
        token: utils.generateUUID(),
        uid: req.user.uid,
        description: req.body.description || '',
        timestamp: Date.now(),
    };
    settings.tokens.push(newToken);
    yield meta_1.default.settings.set('core.api', settings);
    helpers_1.default.formatApiResponse(200, res, newToken);
});
Users.deleteToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield hasAdminPrivilege(req.uid, 'settings');
    if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
        return helpers_1.default.formatApiResponse(401, res);
    }
    const settings = yield meta_1.default.settings.get('core.api');
    const beforeLen = settings.tokens.length;
    settings.tokens = settings.tokens.filter((tokenObj) => tokenObj.token !== req.params.token);
    if (beforeLen !== settings.tokens.length) {
        yield meta_1.default.settings.set('core.api', settings);
        helpers_1.default.formatApiResponse(200, res);
    }
    else {
        helpers_1.default.formatApiResponse(404, res);
    }
});
const getSessionAsync = util.promisify((sid, callback) => {
    db.sessionStore.get(sid, (err, sessionObj) => callback(err, sessionObj || null));
});
Users.revokeSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Only admins or global mods (besides the user themselves) can revoke sessions
    if (parseInt(req.params.uid, 10) !== req.uid && !(yield user_1.default.isAdminOrGlobalMod(req.uid))) {
        return helpers_1.default.formatApiResponse(404, res);
    }
    const sids = yield db.getSortedSetRange(`uid:${req.params.uid}:sessions`, 0, -1);
    let _id;
    for (const sid of sids) {
        /* eslint-disable no-await-in-loop */
        const sessionObj = yield getSessionAsync(sid);
        if (sessionObj && sessionObj.meta && sessionObj.meta.uuid === req.params.uuid) {
            _id = sid;
            break;
        }
    }
    if (!_id) {
        throw new Error('[[error:no-session-found]]');
    }
    yield user_1.default.auth.revokeSession(_id, req.params.uid);
    helpers_1.default.formatApiResponse(200, res);
});
Users.invite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { emails, groupsToJoin = [] } = req.body;
    if (!emails || !Array.isArray(groupsToJoin)) {
        return helpers_1.default.formatApiResponse(400, res, new Error('[[error:invalid-data]]'));
    }
    // For simplicity, this API route is restricted to self-use only. This can change if needed.
    if (parseInt(req.user.uid, 10) !== parseInt(req.params.uid, 10)) {
        return helpers_1.default.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
    }
    const canInvite = yield privileges.users.hasInvitePrivilege(req.uid);
    if (!canInvite) {
        return helpers_1.default.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
    }
    const { registrationType } = meta_1.default.config;
    const isAdmin = yield user_1.default.isAdministrator(req.uid);
    if (registrationType === 'admin-invite-only' && !isAdmin) {
        return helpers_1.default.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
    }
    const inviteGroups = (yield groups.getUserInviteGroups(req.uid)).map((group) => group.name);
    const cannotInvite = groupsToJoin.some(group => !inviteGroups.includes(group));
    if (groupsToJoin.length > 0 && cannotInvite) {
        return helpers_1.default.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
    }
    const max = meta_1.default.config.maximumInvites;
    const emailsArr = emails.split(',').map((email) => email.trim()).filter(Boolean);
    for (const email of emailsArr) {
        /* eslint-disable no-await-in-loop */
        let invites = 0;
        if (max) {
            invites = yield user_1.default.getInvitesNumber(req.uid);
        }
        if (!isAdmin && max && invites >= max) {
            return helpers_1.default.formatApiResponse(403, res, new Error(`[[error:invite-maximum-met, ${invites}, ${max}]]`));
        }
        yield user_1.default.sendInvitationEmail(req.uid, email, groupsToJoin);
    }
    return helpers_1.default.formatApiResponse(200, res);
});
Users.getInviteGroups = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
            return helpers_1.default.formatApiResponse(401, res);
        }
        const userInviteGroups = yield groups.getUserInviteGroups(req.params.uid);
        return helpers_1.default.formatApiResponse(200, res, userInviteGroups.map((group) => group.displayName));
    });
};
Users.listEmails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [isPrivileged, { showemail }] = yield Promise.all([
        user_1.default.isPrivileged(req.uid),
        user_1.default.getSettings(req.params.uid),
    ]);
    const isSelf = req.uid === parseInt(req.params.uid, 10);
    if (isSelf || isPrivileged || showemail) {
        const emails = yield db.getSortedSetRangeByScore('email:uid', 0, 500, req.params.uid, req.params.uid);
        helpers_1.default.formatApiResponse(200, res, { emails });
    }
    else {
        helpers_1.default.formatApiResponse(204, res);
    }
});
Users.getEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [isPrivileged, { showemail }, exists] = yield Promise.all([
        user_1.default.isPrivileged(req.uid),
        user_1.default.getSettings(req.params.uid),
        db.isSortedSetMember('email:uid', req.params.email.toLowerCase()),
    ]);
    const isSelf = req.uid === parseInt(req.params.uid, 10);
    if (exists && (isSelf || isPrivileged || showemail)) {
        helpers_1.default.formatApiResponse(204, res);
    }
    else {
        helpers_1.default.formatApiResponse(404, res);
    }
});
Users.confirmEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [pending, current, canManage] = yield Promise.all([
        user_1.default.email.isValidationPending(req.params.uid, req.params.email),
        user_1.default.getUserField(req.params.uid, 'email'),
        privileges.admin.can('admin:users', req.uid),
    ]);
    if (!canManage) {
        return helpers_1.default.notAllowed(req, res);
    }
    if (pending) { // has active confirmation request
        const code = yield db.get(`confirm:byUid:${req.params.uid}`);
        yield user_1.default.email.confirmByCode(code, req.session.id);
        helpers_1.default.formatApiResponse(200, res);
    }
    else if (current && current === req.params.email) { // i.e. old account w/ unconf. email in user hash
        yield user_1.default.email.confirmByUid(req.params.uid);
        helpers_1.default.formatApiResponse(200, res);
    }
    else {
        helpers_1.default.formatApiResponse(404, res);
    }
});
const prepareExport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [extension] = exportMetadata.get(req.params.type);
    const filename = `${req.params.uid}_${req.params.type}.${extension}`;
    try {
        const stat = yield fs.stat(path_1.default.join(__dirname, '../../../build/export', filename));
        const modified = new Date(stat.mtimeMs);
        res.set('Last-Modified', modified.toUTCString());
        res.set('ETag', `"${crypto.createHash('md5').update(String(stat.mtimeMs)).digest('hex')}"`);
        res.status(204);
        return true;
    }
    catch (e) {
        res.status(404);
        return false;
    }
});
Users.checkExportByType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield prepareExport(req, res);
    res.end();
});
Users.getExportByType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [extension, mime] = exportMetadata.get(req.params.type);
    const filename = `${req.params.uid}_${req.params.type}.${extension}`;
    const exists = yield prepareExport(req, res);
    if (!exists) {
        return res.end();
    }
    res.status(200);
    res.sendFile(filename, {
        root: path_1.default.join(__dirname, '../../../build/export'),
        headers: {
            'Content-Type': mime,
            'Content-Disposition': `attachment; filename=${filename}`,
        },
    }, (err) => {
        if (err) {
            throw err;
        }
    });
});
Users.generateExportsByType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.users.generateExport(req, req.params);
    helpers_1.default.formatApiResponse(202, res);
});
