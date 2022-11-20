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
const meta_1 = __importDefault(require("../meta"));
const groups = require('../groups');
const user_1 = __importDefault(require("../user"));
const helpers = require('./helpers').defualt;
const pagination = require('../pagination');
const privileges = require('../privileges');
const groupsController = {};
groupsController.list = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const sort = req.query.sort || 'alpha';
        const [groupData, allowGroupCreation] = yield Promise.all([
            groups.getGroupsBySort(sort, 0, 14),
            privileges.global.can('group:create', req.uid),
        ]);
        res.render('groups/list', {
            groups: groupData,
            allowGroupCreation: allowGroupCreation,
            nextStart: 15,
            title: '[[pages:groups]]',
            breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
        });
    });
};
groupsController.details = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const lowercaseSlug = req.params.slug.toLowerCase();
        if (req.params.slug !== lowercaseSlug) {
            if (res.locals.isAPI) {
                req.params.slug = lowercaseSlug;
            }
            else {
                return res.redirect(`${nconf_1.default.get('relative_path')}/groups/${lowercaseSlug}`);
            }
        }
        const groupName = yield groups.getGroupNameByGroupSlug(req.params.slug);
        if (!groupName) {
            return next();
        }
        const [exists, isHidden, isAdmin, isGlobalMod] = yield Promise.all([
            groups.exists(groupName),
            groups.isHidden(groupName),
            user_1.default.isAdministrator(req.uid),
            user_1.default.isGlobalModerator(req.uid),
        ]);
        if (!exists) {
            return next();
        }
        if (isHidden && !isAdmin && !isGlobalMod) {
            const [isMember, isInvited] = yield Promise.all([
                groups.isMember(req.uid, groupName),
                groups.isInvited(req.uid, groupName),
            ]);
            if (!isMember && !isInvited) {
                return next();
            }
        }
        const [groupData, posts] = yield Promise.all([
            groups.get(groupName, {
                uid: req.uid,
                truncateUserList: true,
                userListCount: 20,
            }),
            groups.getLatestMemberPosts(groupName, 10, req.uid),
        ]);
        if (!groupData) {
            return next();
        }
        groupData.isOwner = groupData.isOwner || isAdmin || (isGlobalMod && !groupData.system);
        res.render('groups/details', {
            title: `[[pages:group, ${groupData.displayName}]]`,
            group: groupData,
            posts: posts,
            isAdmin: isAdmin,
            isGlobalMod: isGlobalMod,
            allowPrivateGroups: meta_1.default.config.allowPrivateGroups,
            breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
        });
    });
};
groupsController.members = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const usersPerPage = 50;
        const start = Math.max(0, (page - 1) * usersPerPage);
        const stop = start + usersPerPage - 1;
        const groupName = yield groups.getGroupNameByGroupSlug(req.params.slug);
        if (!groupName) {
            return next();
        }
        const [groupData, isAdminOrGlobalMod, isMember, isHidden] = yield Promise.all([
            groups.getGroupData(groupName),
            user_1.default.isAdminOrGlobalMod(req.uid),
            groups.isMember(req.uid, groupName),
            groups.isHidden(groupName),
        ]);
        if (isHidden && !isMember && !isAdminOrGlobalMod) {
            return next();
        }
        const users = yield user_1.default.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop);
        const breadcrumbs = helpers.buildBreadcrumbs([
            { text: '[[pages:groups]]', url: '/groups' },
            { text: validator.escape(String(groupName)), url: `/groups/${req.params.slug}` },
            { text: '[[groups:details.members]]' },
        ]);
        const pageCount = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
        res.render('groups/members', {
            users: users,
            pagination: pagination.create(page, pageCount, req.query),
            breadcrumbs: breadcrumbs,
        });
    });
};
