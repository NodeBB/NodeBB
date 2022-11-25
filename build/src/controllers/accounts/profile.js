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
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const database = __importStar(require("../../database"));
const db = database;
const user_1 = __importDefault(require("../../user"));
const posts = require('../../posts');
const categories_1 = __importDefault(require("../../categories"));
const plugins = require('../../plugins');
const meta_1 = __importDefault(require("../../meta"));
const privileges = require('../../privileges');
const accountHelpers = require('./helpers').defualt;
const helpers_1 = __importDefault(require("../helpers"));
const utils = require('../../utils');
const profileController = {};
profileController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const lowercaseSlug = req.params.userslug.toLowerCase();
        if (req.params.userslug !== lowercaseSlug) {
            if (res.locals.isAPI) {
                req.params.userslug = lowercaseSlug;
            }
            else {
                return res.redirect(`${nconf_1.default.get('relative_path')}/user/${lowercaseSlug}`);
            }
        }
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        yield incrementProfileViews(req, userData);
        const [latestPosts, bestPosts] = yield Promise.all([
            getLatestPosts(req.uid, userData),
            getBestPosts(req.uid, userData),
            posts.parseSignature(userData, req.uid),
        ]);
        if (meta_1.default.config['reputation:disabled']) {
            delete userData.reputation;
        }
        userData.posts = latestPosts; // for backwards compat.
        userData.latestPosts = latestPosts;
        userData.bestPosts = bestPosts;
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username }]);
        userData.title = userData.username;
        userData.allowCoverPicture = !userData.isSelf || !!meta_1.default.config['reputation:disabled'] || userData.reputation >= meta_1.default.config['min:rep:cover-picture'];
        // Show email changed modal on first access after said change
        userData.emailChanged = req.session.emailChanged;
        delete req.session.emailChanged;
        if (!userData.profileviews) {
            userData.profileviews = 1;
        }
        addMetaTags(res, userData);
        userData.selectedGroup = userData.groups.filter((group) => group && userData.groupTitleArray.includes(group.name))
            .sort((a, b) => userData.groupTitleArray.indexOf(a.name) - userData.groupTitleArray.indexOf(b.name));
        res.render('account/profile', userData);
    });
};
function incrementProfileViews(req, userData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.uid >= 1) {
            req.session.uids_viewed = req.session.uids_viewed || {};
            if (req.uid !== userData.uid &&
                (!req.session.uids_viewed[userData.uid] || req.session.uids_viewed[userData.uid] < Date.now() - 3600000)) {
                yield user_1.default.incrementUserFieldBy(userData.uid, 'profileviews', 1);
                req.session.uids_viewed[userData.uid] = Date.now();
            }
        }
    });
}
function getLatestPosts(callerUid, userData) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getPosts(callerUid, userData, 'pids');
    });
}
function getBestPosts(callerUid, userData) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getPosts(callerUid, userData, 'pids:votes');
    });
}
function getPosts(callerUid, userData, setSuffix) {
    return __awaiter(this, void 0, void 0, function* () {
        // @ts-ignore
        const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', callerUid, 'topics:read');
        const keys = cids.map((c) => `cid:${c}:uid:${userData.uid}:${setSuffix}`);
        let hasMorePosts = true;
        let start = 0;
        const count = 10;
        const postData = [];
        const [isAdmin, isModOfCids, canSchedule] = yield Promise.all([
            user_1.default.isAdministrator(callerUid),
            user_1.default.isModerator(callerUid, cids),
            privileges.categories.isUserAllowedTo('topics:schedule', cids, callerUid),
        ]);
        const cidToIsMod = _.zipObject(cids, isModOfCids);
        const cidToCanSchedule = _.zipObject(cids, canSchedule);
        do {
            /* eslint-disable no-await-in-loop */
            let pids = yield db.getSortedSetRevRange(keys, start, start + count - 1);
            if (!pids.length || pids.length < count) {
                hasMorePosts = false;
            }
            if (pids.length) {
                ({ pids } = yield plugins.hooks.fire('filter:account.profile.getPids', {
                    uid: callerUid,
                    userData,
                    setSuffix,
                    pids,
                }));
                const p = yield posts.getPostSummaryByPids(pids, callerUid, { stripTags: false });
                postData.push(...p.filter((p) => p && p.topic && (isAdmin || cidToIsMod[p.topic.cid] ||
                    (p.topic.scheduled && cidToCanSchedule[p.topic.cid]) || (!p.deleted && !p.topic.deleted))));
            }
            start += count;
        } while (postData.length < count && hasMorePosts);
        return postData.slice(0, count);
    });
}
function addMetaTags(res, userData) {
    const plainAboutMe = userData.aboutme ? utils.stripHTMLTags(utils.decodeHTMLEntities(userData.aboutme)) : '';
    res.locals.metaTags = [
        {
            name: 'title',
            content: userData.fullname || userData.username,
            noEscape: true,
        },
        {
            name: 'description',
            content: plainAboutMe,
        },
        {
            property: 'og:title',
            content: userData.fullname || userData.username,
            noEscape: true,
        },
        {
            property: 'og:description',
            content: plainAboutMe,
        },
    ];
    if (userData.picture) {
        res.locals.metaTags.push({
            property: 'og:image',
            content: userData.picture,
            noEscape: true,
        }, {
            property: 'og:image:url',
            content: userData.picture,
            noEscape: true,
        });
    }
}
