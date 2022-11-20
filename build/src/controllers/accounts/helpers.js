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
const validator = require('validator');
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../../database"));
const user_1 = __importDefault(require("../../user"));
const groups = require('../../groups');
const plugins = require('../../plugins');
const meta_1 = __importDefault(require("../../meta"));
const utils = require('../../utils');
const privileges = require('../../privileges');
const translator = require('../../translator');
const messaging = require('../../messaging');
const categories_1 = __importDefault(require("../../categories"));
const helpers = {};
helpers.getUserDataByUserSlug = function (userslug, callerUID, query = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = yield user_1.default.getUidByUserslug(userslug);
        if (!uid) {
            return null;
        }
        const results = yield getAllData(uid, callerUID);
        if (!results.userData) {
            throw new Error('[[error:invalid-uid]]');
        }
        yield parseAboutMe(results.userData);
        let { userData } = results;
        const { userSettings } = results;
        const { isAdmin } = results;
        const { isGlobalModerator } = results;
        const { isModerator } = results;
        const { canViewInfo } = results;
        const isSelf = parseInt(callerUID, 10) === parseInt(userData.uid, 10);
        userData.age = Math.max(0, userData.birthday ? Math.floor((new Date().getTime() - new Date(userData.birthday).getTime()) / 31536000000) : 0);
        userData = yield user_1.default.hidePrivateData(userData, callerUID);
        userData.emailClass = userSettings.showemail ? 'hide' : '';
        // If email unconfirmed, hide from result set
        if (!userData['email:confirmed']) {
            userData.email = '';
        }
        if (isAdmin || isSelf || (canViewInfo && !results.isTargetAdmin)) {
            userData.ips = results.ips;
        }
        if (!isAdmin && !isGlobalModerator && !isModerator) {
            userData.moderationNote = undefined;
        }
        userData.isBlocked = results.isBlocked;
        userData.yourid = callerUID;
        userData.theirid = userData.uid;
        userData.isTargetAdmin = results.isTargetAdmin;
        userData.isAdmin = isAdmin;
        userData.isGlobalModerator = isGlobalModerator;
        userData.isModerator = isModerator;
        userData.isAdminOrGlobalModerator = isAdmin || isGlobalModerator;
        userData.isAdminOrGlobalModeratorOrModerator = isAdmin || isGlobalModerator || isModerator;
        userData.isSelfOrAdminOrGlobalModerator = isSelf || isAdmin || isGlobalModerator;
        userData.canEdit = results.canEdit;
        userData.canBan = results.canBanUser;
        userData.canMute = results.canMuteUser;
        userData.canFlag = (yield privileges.users.canFlag(callerUID, userData.uid)).flag;
        userData.canChangePassword = isAdmin || (isSelf && !meta_1.default.config['password:disableEdit']);
        userData.isSelf = isSelf;
        userData.isFollowing = results.isFollowing;
        userData.hasPrivateChat = results.hasPrivateChat;
        userData.showHidden = results.canEdit; // remove in v1.19.0
        userData.groups = Array.isArray(results.groups) && results.groups.length ? results.groups[0] : [];
        userData.disableSignatures = meta_1.default.config.disableSignatures === 1;
        userData['reputation:disabled'] = meta_1.default.config['reputation:disabled'] === 1;
        userData['downvote:disabled'] = meta_1.default.config['downvote:disabled'] === 1;
        userData['email:confirmed'] = !!userData['email:confirmed'];
        userData.profile_links = filterLinks(results.profile_menu.links, {
            self: isSelf,
            other: !isSelf,
            moderator: isModerator,
            globalMod: isGlobalModerator,
            admin: isAdmin,
            canViewInfo: canViewInfo,
        });
        userData.sso = results.sso.associations;
        userData.banned = Boolean(userData.banned);
        userData.muted = parseInt(userData.mutedUntil, 10) > Date.now();
        userData.website = escape(userData.website);
        userData.websiteLink = !userData.website.startsWith('http') ? `http://${userData.website}` : userData.website;
        userData.websiteName = userData.website.replace(validator.escape('http://'), '').replace(validator.escape('https://'), '');
        userData.fullname = escape(userData.fullname);
        userData.location = escape(userData.location);
        userData.signature = escape(userData.signature);
        userData.birthday = validator.escape(String(userData.birthday || ''));
        userData.moderationNote = validator.escape(String(userData.moderationNote || ''));
        if (userData['cover:url']) {
            userData['cover:url'] = userData['cover:url'].startsWith('http') ? userData['cover:url'] : (nconf_1.default.get('relative_path') + userData['cover:url']);
        }
        else {
            userData['cover:url'] = require('../../coverPhoto').getDefaultProfileCover(userData.uid);
        }
        userData['cover:position'] = validator.escape(String(userData['cover:position'] || '50% 50%'));
        userData['username:disableEdit'] = !userData.isAdmin && meta_1.default.config['username:disableEdit'];
        userData['email:disableEdit'] = !userData.isAdmin && meta_1.default.config['email:disableEdit'];
        yield getCounts(userData, callerUID);
        const hookData = yield plugins.hooks.fire('filter:helpers.getUserDataByUserSlug', {
            userData: userData,
            callerUID: callerUID,
            query: query,
        });
        return hookData.userData;
    });
};
function escape(value) {
    return translator.escape(validator.escape(String(value || '')));
}
function getAllData(uid, callerUID) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            userData: user_1.default.getUserData(uid),
            isTargetAdmin: user_1.default.isAdministrator(uid),
            userSettings: user_1.default.getSettings(uid),
            isAdmin: user_1.default.isAdministrator(callerUID),
            isGlobalModerator: user_1.default.isGlobalModerator(callerUID),
            isModerator: user_1.default.isModeratorOfAnyCategory(callerUID),
            isFollowing: user_1.default.isFollowing(callerUID, uid),
            ips: user_1.default.getIPs(uid, 4),
            profile_menu: getProfileMenu(uid, callerUID),
            groups: groups.getUserGroups([uid]),
            sso: plugins.hooks.fire('filter:auth.list', { uid: uid, associations: [] }),
            canEdit: privileges.users.canEdit(callerUID, uid),
            canBanUser: privileges.users.canBanUser(callerUID, uid),
            canMuteUser: privileges.users.canMuteUser(callerUID, uid),
            isBlocked: user_1.default.blocks.is(uid, callerUID),
            canViewInfo: privileges.global.can('view:users:info', callerUID),
            hasPrivateChat: messaging.hasPrivateChat(callerUID, uid),
        });
    });
}
function getCounts(userData, callerUID) {
    return __awaiter(this, void 0, void 0, function* () {
        const { uid } = userData;
        // @ts-ignore
        const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', callerUID, 'topics:read');
        const promises = {
            posts: database_1.default.sortedSetsCardSum(cids.map((c) => `cid:${c}:uid:${uid}:pids`)),
            best: Promise.all(cids.map((c) => __awaiter(this, void 0, void 0, function* () { return database_1.default.sortedSetCount(`cid:${c}:uid:${uid}:pids:votes`, 1, '+inf'); }))),
            controversial: Promise.all(cids.map((c) => __awaiter(this, void 0, void 0, function* () { return database_1.default.sortedSetCount(`cid:${c}:uid:${uid}:pids:votes`, '-inf', -1); }))),
            topics: database_1.default.sortedSetsCardSum(cids.map((c) => `cid:${c}:uid:${uid}:tids`)),
        };
        if (userData.isAdmin || userData.isSelf) {
            promises.ignored = database_1.default.sortedSetCard(`uid:${uid}:ignored_tids`);
            promises.watched = database_1.default.sortedSetCard(`uid:${uid}:followed_tids`);
            promises.upvoted = database_1.default.sortedSetCard(`uid:${uid}:upvote`);
            promises.downvoted = database_1.default.sortedSetCard(`uid:${uid}:downvote`);
            promises.bookmarks = database_1.default.sortedSetCard(`uid:${uid}:bookmarks`);
            promises.uploaded = database_1.default.sortedSetCard(`uid:${uid}:uploads`);
            promises.categoriesWatched = user_1.default.getWatchedCategories(uid);
            promises.blocks = user_1.default.getUserField(userData.uid, 'blocksCount');
        }
        const counts = yield utils.promiseParallel(promises);
        counts.best = counts.best.reduce((sum, count) => sum + count, 0);
        counts.controversial = counts.controversial.reduce((sum, count) => sum + count, 0);
        counts.categoriesWatched = counts.categoriesWatched && counts.categoriesWatched.length;
        counts.groups = userData.groups.length;
        counts.following = userData.followingCount;
        counts.followers = userData.followerCount;
        userData.blocksCount = counts.blocks || 0; // for backwards compatibility, remove in 1.16.0
        userData.counts = counts;
    });
}
function getProfileMenu(uid, callerUID) {
    return __awaiter(this, void 0, void 0, function* () {
        const links = [{
                id: 'info',
                route: 'info',
                name: '[[user:account_info]]',
                icon: 'fa-info',
                visibility: {
                    self: false,
                    other: false,
                    moderator: false,
                    globalMod: false,
                    admin: true,
                    canViewInfo: true,
                },
            }, {
                id: 'sessions',
                route: 'sessions',
                name: '[[pages:account/sessions]]',
                icon: 'fa-group',
                visibility: {
                    self: true,
                    other: false,
                    moderator: false,
                    globalMod: false,
                    admin: false,
                    canViewInfo: false,
                },
            }];
        if (meta_1.default.config.gdpr_enabled) {
            links.push({
                id: 'consent',
                route: 'consent',
                name: '[[user:consent.title]]',
                icon: 'fa-thumbs-o-up',
                visibility: {
                    self: true,
                    other: false,
                    moderator: false,
                    globalMod: false,
                    admin: false,
                    canViewInfo: false,
                },
            });
        }
        return yield plugins.hooks.fire('filter:user.profileMenu', {
            uid: uid,
            callerUID: callerUID,
            links: links,
        });
    });
}
function parseAboutMe(userData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!userData.aboutme) {
            userData.aboutme = '';
            userData.aboutmeParsed = '';
            return;
        }
        userData.aboutme = validator.escape(String(userData.aboutme || ''));
        const parsed = yield plugins.hooks.fire('filter:parse.aboutme', userData.aboutme);
        userData.aboutme = translator.escape(userData.aboutme);
        userData.aboutmeParsed = translator.escape(parsed);
    });
}
function filterLinks(links, states) {
    return links.filter((link, index) => {
        // Default visibility
        link.visibility = Object.assign({ self: true, other: true, moderator: true, globalMod: true, admin: true, canViewInfo: true }, link.visibility);
        const permit = Object.keys(states).some(state => states[state] && link.visibility[state]);
        links[index].public = permit;
        return permit;
    });
}
require('../../promisify').promisify(helpers);
exports.default = helpers;
