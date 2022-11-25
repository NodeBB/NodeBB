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
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const plugins = require('../plugins');
const privileges = require('../privileges');
const utils = require('../utils');
const slugify = require('../slugify');
const cache = require('../cache');
function default_1(Categories) {
    Categories.create = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const parentCid = data.parentCid ? data.parentCid : 0;
            const [cid, firstChild] = yield Promise.all([
                db.incrObjectField('global', 'nextCid'),
                db.getSortedSetRangeWithScores(`cid:${parentCid}:children`, 0, 0),
            ]);
            data.name = String(data.name || `Category ${cid}`);
            const slug = `${cid}/${slugify(data.name)}`;
            const smallestOrder = firstChild.length ? firstChild[0].score - 1 : 1;
            const order = data.order || smallestOrder; // If no order provided, place it at the top
            const colours = Categories.assignColours();
            let category = {
                cid: cid,
                name: data.name,
                description: data.description ? data.description : '',
                descriptionParsed: data.descriptionParsed ? data.descriptionParsed : '',
                icon: data.icon ? data.icon : '',
                bgColor: data.bgColor || colours[0],
                color: data.color || colours[1],
                slug: slug,
                parentCid: parentCid,
                topic_count: 0,
                post_count: 0,
                disabled: data.disabled ? 1 : 0,
                order: order,
                link: data.link || '',
                numRecentReplies: 1,
                class: (data.class ? data.class : 'col-md-3 col-6'),
                imageClass: 'cover',
                isSection: 0,
                subCategoriesPerPage: 10,
            };
            if (data.backgroundImage) {
                category.backgroundImage = data.backgroundImage;
            }
            const defaultPrivileges = [
                'groups:find',
                'groups:read',
                'groups:topics:read',
                'groups:topics:create',
                'groups:topics:reply',
                'groups:topics:tag',
                'groups:posts:edit',
                'groups:posts:history',
                'groups:posts:delete',
                'groups:posts:upvote',
                'groups:posts:downvote',
                'groups:topics:delete',
            ];
            const modPrivileges = defaultPrivileges.concat([
                'groups:topics:schedule',
                'groups:posts:view_deleted',
                'groups:purge',
            ]);
            const guestPrivileges = ['groups:find', 'groups:read', 'groups:topics:read'];
            const result = yield plugins.hooks.fire('filter:category.create', {
                category: category,
                data: data,
                defaultPrivileges: defaultPrivileges,
                modPrivileges: modPrivileges,
                guestPrivileges: guestPrivileges,
            });
            category = result.category;
            yield db.setObject(`category:${category.cid}`, category);
            if (!category.descriptionParsed) {
                yield Categories.parseDescription(category.cid, category.description);
            }
            yield db.sortedSetAddBulk([
                ['categories:cid', category.order, category.cid],
                [`cid:${parentCid}:children`, category.order, category.cid],
                ['categories:name', 0, `${data.name.slice(0, 200).toLowerCase()}:${category.cid}`],
            ]);
            yield privileges.categories.give(result.defaultPrivileges, category.cid, 'registered-users');
            yield privileges.categories.give(result.modPrivileges, category.cid, ['administrators', 'Global Moderators']);
            yield privileges.categories.give(result.guestPrivileges, category.cid, ['guests', 'spiders']);
            cache.del([
                'categories:cid',
                `cid:${parentCid}:children`,
                `cid:${parentCid}:children:all`,
            ]);
            if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
                category = yield Categories.copySettingsFrom(data.cloneFromCid, category.cid, !data.parentCid);
            }
            if (data.cloneChildren) {
                yield duplicateCategoriesChildren(category.cid, data.cloneFromCid, data.uid);
            }
            plugins.hooks.fire('action:category.create', { category: category });
            return category;
        });
    };
    function duplicateCategoriesChildren(parentCid, cid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            let children = yield Categories.getChildren([cid], uid);
            if (!children.length) {
                return;
            }
            children = children[0];
            children.forEach((child) => {
                child.parentCid = parentCid;
                child.cloneFromCid = child.cid;
                child.cloneChildren = true;
                child.name = utils.decodeHTMLEntities(child.name);
                child.description = utils.decodeHTMLEntities(child.description);
                child.uid = uid;
            });
            yield async.each(children, Categories.create);
        });
    }
    Categories.assignColours = function () {
        const backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
        const text = ['#ffffff', '#ffffff', '#333333', '#ffffff', '#333333', '#ffffff', '#ffffff', '#ffffff'];
        const index = Math.floor(Math.random() * backgrounds.length);
        return [backgrounds[index], text[index]];
    };
    Categories.copySettingsFrom = function (fromCid, toCid, copyParent) {
        return __awaiter(this, void 0, void 0, function* () {
            const [source, destination] = yield Promise.all([
                db.getObject(`category:${fromCid}`),
                db.getObject(`category:${toCid}`),
            ]);
            if (!source) {
                throw new Error('[[error:invalid-cid]]');
            }
            const oldParent = parseInt(destination.parentCid, 10) || 0;
            const newParent = parseInt(source.parentCid, 10) || 0;
            if (copyParent && newParent !== parseInt(toCid, 10)) {
                yield db.sortedSetRemove(`cid:${oldParent}:children`, toCid);
                yield db.sortedSetAdd(`cid:${newParent}:children`, source.order, toCid);
                cache.del([
                    `cid:${oldParent}:children`,
                    `cid:${oldParent}:children:all`,
                    `cid:${newParent}:children`,
                    `cid:${newParent}:children:all`,
                ]);
            }
            destination.description = source.description;
            destination.descriptionParsed = source.descriptionParsed;
            destination.icon = source.icon;
            destination.bgColor = source.bgColor;
            destination.color = source.color;
            destination.link = source.link;
            destination.numRecentReplies = source.numRecentReplies;
            destination.class = source.class;
            destination.image = source.image;
            destination.imageClass = source.imageClass;
            destination.minTags = source.minTags;
            destination.maxTags = source.maxTags;
            if (copyParent) {
                destination.parentCid = source.parentCid || 0;
            }
            yield plugins.hooks.fire('filter:categories.copySettingsFrom', {
                source: source,
                destination: destination,
                copyParent: copyParent,
            });
            yield db.setObject(`category:${toCid}`, destination);
            yield copyTagWhitelist(fromCid, toCid);
            yield Categories.copyPrivilegesFrom(fromCid, toCid);
            return destination;
        });
    };
    function copyTagWhitelist(fromCid, toCid) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield db.getSortedSetRangeWithScores(`cid:${fromCid}:tag:whitelist`, 0, -1);
            yield db.delete(`cid:${toCid}:tag:whitelist`);
            yield db.sortedSetAdd(`cid:${toCid}:tag:whitelist`, data.map((item) => item.score), data.map((item) => item.value));
            cache.del(`cid:${toCid}:tag:whitelist`);
        });
    }
    Categories.copyPrivilegesFrom = function (fromCid, toCid, group, filter = []) {
        return __awaiter(this, void 0, void 0, function* () {
            group = group || '';
            let privsToCopy;
            if (group) {
                const groupPrivilegeList = yield privileges.categories.getGroupPrivilegeList();
                privsToCopy = groupPrivilegeList.slice(...filter);
            }
            else {
                const privs = yield privileges.categories.getPrivilegeList();
                const halfIdx = privs.length / 2;
                privsToCopy = privs.slice(0, halfIdx).slice(...filter).concat(privs.slice(halfIdx).slice(...filter));
            }
            const data = yield plugins.hooks.fire('filter:categories.copyPrivilegesFrom', {
                privileges: privsToCopy,
                fromCid: fromCid,
                toCid: toCid,
                group: group,
            });
            if (group) {
                yield copyPrivilegesByGroup(data.privileges, data.fromCid, data.toCid, group);
            }
            else {
                yield copyPrivileges(data.privileges, data.fromCid, data.toCid);
            }
        });
    };
    function copyPrivileges(privileges, fromCid, toCid) {
        return __awaiter(this, void 0, void 0, function* () {
            const toGroups = privileges.map(privilege => `group:cid:${toCid}:privileges:${privilege}:members`);
            const fromGroups = privileges.map(privilege => `group:cid:${fromCid}:privileges:${privilege}:members`);
            const currentMembers = yield db.getSortedSetsMembers(toGroups.concat(fromGroups));
            const copyGroups = _.uniq(_.flatten(currentMembers));
            yield async.each(copyGroups, (group) => __awaiter(this, void 0, void 0, function* () {
                yield copyPrivilegesByGroup(privileges, fromCid, toCid, group);
            }));
        });
    }
    function copyPrivilegesByGroup(privilegeList, fromCid, toCid, group) {
        return __awaiter(this, void 0, void 0, function* () {
            const fromGroups = privilegeList.map(privilege => `group:cid:${fromCid}:privileges:${privilege}:members`);
            const toGroups = privilegeList.map(privilege => `group:cid:${toCid}:privileges:${privilege}:members`);
            const [fromChecks, toChecks] = yield Promise.all([
                db.isMemberOfSortedSets(fromGroups, group),
                db.isMemberOfSortedSets(toGroups, group),
            ]);
            const givePrivs = privilegeList.filter((priv, index) => fromChecks[index] && !toChecks[index]);
            const rescindPrivs = privilegeList.filter((priv, index) => !fromChecks[index] && toChecks[index]);
            yield privileges.categories.give(givePrivs, toCid, group);
            yield privileges.categories.rescind(rescindPrivs, toCid, group);
        });
    }
}
exports.default = default_1;
;
