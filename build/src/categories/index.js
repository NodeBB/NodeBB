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
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
const groups = require('../groups');
const plugins = require('../plugins');
const privileges = require('../privileges');
const cache = require('../cache');
const meta_1 = __importDefault(require("../meta"));
const Categories = {};
require('./data').default(Categories);
require('./create').default(Categories);
require('./delete').default(Categories);
require('./topics').default(Categories);
require('./unread').default(Categories);
require('./activeusers').default(Categories);
require('./recentreplies').default(Categories);
require('./update').default(Categories);
require('./watch').default(Categories);
require('./search').default(Categories);
Categories.exists = function (cids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db.exists(Array.isArray(cids) ? cids.map((cid) => `category:${cid}`) : `category:${cids}`);
    });
};
Categories.getCategoryById = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        const categories = yield Categories.getCategories([data.cid], data.uid);
        if (!categories[0]) {
            return null;
        }
        const category = categories[0];
        data.category = category;
        const promises = [
            Categories.getCategoryTopics(data),
            Categories.getTopicCount(data),
            Categories.getWatchState([data.cid], data.uid),
            getChildrenTree(category, data.uid),
        ];
        if (category.parentCid) {
            promises.push(Categories.getCategoryData(category.parentCid));
        }
        const [topics, topicCount, watchState, , parent] = yield Promise.all(promises);
        category.topics = topics.topics;
        category.nextStart = topics.nextStart;
        category.topic_count = topicCount;
        category.isWatched = watchState[0] === Categories.watchStates.watching;
        category.isNotWatched = watchState[0] === Categories.watchStates.notwatching;
        category.isIgnored = watchState[0] === Categories.watchStates.ignoring;
        category.parent = parent;
        calculateTopicPostCount(category);
        const result = yield plugins.hooks.fire('filter:category.get', Object.assign({ category: category }, data));
        return result.category;
    });
};
Categories.getAllCidsFromSet = function (key) {
    return __awaiter(this, void 0, void 0, function* () {
        let cids = cache.get(key);
        if (cids) {
            return cids.slice();
        }
        cids = yield db.getSortedSetRange(key, 0, -1);
        cids = cids.map((cid) => parseInt(cid, 10));
        cache.set(key, cids);
        return cids.slice();
    });
};
Categories.getAllCategories = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield Categories.getAllCidsFromSet('categories:cid');
        return yield Categories.getCategories(cids, uid);
    });
};
Categories.getCidsByPrivilege = function (set, uid, privilege) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield Categories.getAllCidsFromSet(set);
        return yield privileges.categories.filterCids(privilege, cids, uid);
    });
};
Categories.getCategoriesByPrivilege = function (set, uid, privilege) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield Categories.getCidsByPrivilege(set, uid, privilege);
        return yield Categories.getCategories(cids, uid);
    });
};
Categories.getModerators = function (cid) {
    return __awaiter(this, void 0, void 0, function* () {
        const uids = yield Categories.getModeratorUids([cid]);
        return yield user_1.default.getUsersFields(uids[0], ['uid', 'username', 'userslug', 'picture']);
    });
};
Categories.getModeratorUids = function (cids) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupNames = cids.reduce((memo, cid) => {
            memo.push(`cid:${cid}:privileges:moderate`);
            memo.push(`cid:${cid}:privileges:groups:moderate`);
            return memo;
        }, []);
        const memberSets = yield groups.getMembersOfGroups(groupNames);
        // Every other set is actually a list of user groups, not uids, so convert those to members
        const sets = memberSets.reduce((memo, set, idx) => {
            if (idx % 2) {
                memo.groupNames.push(set);
            }
            else {
                memo.uids.push(set);
            }
            return memo;
        }, { groupNames: [], uids: [] });
        const uniqGroups = _.uniq(_.flatten(sets.groupNames));
        const groupUids = yield groups.getMembersOfGroups(uniqGroups);
        const map = _.zipObject(uniqGroups, groupUids);
        const moderatorUids = cids.map((cid, index) => _.uniq(sets.uids[index].concat(_.flatten(sets.groupNames[index].map(g => map[g])))));
        return moderatorUids;
    });
};
Categories.getCategories = function (cids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(cids)) {
            throw new Error('[[error:invalid-cid]]');
        }
        if (!cids.length) {
            return [];
        }
        uid = parseInt(uid, 10);
        const [categories, tagWhitelist, hasRead] = yield Promise.all([
            Categories.getCategoriesData(cids),
            Categories.getTagWhitelist(cids),
            Categories.hasReadCategories(cids, uid),
        ]);
        categories.forEach((category, i) => {
            if (category) {
                category.tagWhitelist = tagWhitelist[i];
                category['unread-class'] = (category.topic_count === 0 || (hasRead[i] && uid !== 0)) ? '' : 'unread';
            }
        });
        return categories;
    });
};
Categories.getTagWhitelist = function (cids) {
    return __awaiter(this, void 0, void 0, function* () {
        const cachedData = {};
        const nonCachedCids = cids.filter((cid) => {
            const data = cache.get(`cid:${cid}:tag:whitelist`);
            const isInCache = data !== undefined;
            if (isInCache) {
                cachedData[cid] = data;
            }
            return !isInCache;
        });
        if (!nonCachedCids.length) {
            return cids.map((cid) => cachedData[cid]);
        }
        const keys = nonCachedCids.map((cid) => `cid:${cid}:tag:whitelist`);
        const data = yield db.getSortedSetsMembers(keys);
        nonCachedCids.forEach((cid, index) => {
            cachedData[cid] = data[index];
            cache.set(`cid:${cid}:tag:whitelist`, data[index]);
        });
        return cids.map((cid) => cachedData[cid]);
    });
};
// remove system tags from tag whitelist for non privileged user
Categories.filterTagWhitelist = function (tagWhitelist, isAdminOrMod) {
    const systemTags = (meta_1.default.config.systemTags || '').split(',');
    if (!isAdminOrMod && systemTags.length) {
        return tagWhitelist.filter(tag => !systemTags.includes(tag));
    }
    return tagWhitelist;
};
function calculateTopicPostCount(category) {
    if (!category) {
        return;
    }
    let postCount = category.post_count;
    let topicCount = category.topic_count;
    if (Array.isArray(category.children)) {
        category.children.forEach((child) => {
            calculateTopicPostCount(child);
            postCount += parseInt(child.totalPostCount, 10) || 0;
            topicCount += parseInt(child.totalTopicCount, 10) || 0;
        });
    }
    category.totalPostCount = postCount;
    category.totalTopicCount = topicCount;
}
Categories.calculateTopicPostCount = calculateTopicPostCount;
Categories.getParents = function (cids) {
    return __awaiter(this, void 0, void 0, function* () {
        const categoriesData = yield Categories.getCategoriesFields(cids, ['parentCid']);
        const parentCids = categoriesData.filter(c => c && c.parentCid).map(c => c.parentCid);
        if (!parentCids.length) {
            return cids.map(() => null);
        }
        const parentData = yield Categories.getCategoriesData(parentCids);
        const cidToParent = _.zipObject(parentCids, parentData);
        return categoriesData.map(category => cidToParent[category.parentCid]);
    });
};
Categories.getChildren = function (cids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const categoryData = yield Categories.getCategoriesFields(cids, ['parentCid']);
        const categories = categoryData.map((category, index) => ({ cid: cids[index], parentCid: category.parentCid }));
        yield Promise.all(categories.map(c => getChildrenTree(c, uid)));
        return categories.map(c => c && c.children);
    });
};
function getChildrenTree(category, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let childrenCids = yield Categories.getChildrenCids(category.cid);
        childrenCids = yield privileges.categories.filterCids('find', childrenCids, uid);
        childrenCids = childrenCids.filter((cid) => parseInt(category.cid, 10) !== parseInt(cid, 10));
        if (!childrenCids.length) {
            category.children = [];
            return;
        }
        let childrenData = yield Categories.getCategoriesData(childrenCids);
        childrenData = childrenData.filter(Boolean);
        childrenCids = childrenData.map(child => child.cid);
        const hasRead = yield Categories.hasReadCategories(childrenCids, uid);
        childrenData.forEach((child, i) => {
            child['unread-class'] = (child.topic_count === 0 || (hasRead[i] && uid !== 0)) ? '' : 'unread';
        });
        Categories.getTree([category].concat(childrenData), category.parentCid);
    });
}
Categories.getChildrenTree = getChildrenTree;
Categories.getParentCids = function (currentCid) {
    return __awaiter(this, void 0, void 0, function* () {
        let cid = currentCid;
        const parents = [];
        while (parseInt(cid, 10)) {
            // eslint-disable-next-line
            cid = yield Categories.getCategoryField(cid, 'parentCid');
            if (cid) {
                parents.unshift(cid);
            }
        }
        return parents;
    });
};
Categories.getChildrenCids = function (rootCid) {
    return __awaiter(this, void 0, void 0, function* () {
        let allCids = [];
        function recursive(keys) {
            return __awaiter(this, void 0, void 0, function* () {
                let childrenCids = yield db.getSortedSetRange(keys, 0, -1);
                childrenCids = childrenCids.filter((cid) => !allCids.includes(parseInt(cid, 10)));
                if (!childrenCids.length) {
                    return;
                }
                keys = childrenCids.map((cid) => `cid:${cid}:children`);
                childrenCids.forEach((cid) => allCids.push(parseInt(cid, 10)));
                yield recursive(keys);
            });
        }
        const key = `cid:${rootCid}:children`;
        const cacheKey = `${key}:all`;
        const childrenCids = cache.get(cacheKey);
        if (childrenCids) {
            return childrenCids.slice();
        }
        yield recursive(key);
        allCids = _.uniq(allCids);
        cache.set(cacheKey, allCids);
        return allCids.slice();
    });
};
Categories.flattenCategories = function (allCategories, categoryData) {
    categoryData.forEach((category) => {
        if (category) {
            allCategories.push(category);
            if (Array.isArray(category.children) && category.children.length) {
                Categories.flattenCategories(allCategories, category.children);
            }
        }
    });
};
/**
 * build tree from flat list of categories
 *
 * @param categories {array} flat list of categories
 * @param parentCid {number} start from 0 to build full tree
 */
Categories.getTree = function (categories, parentCid) {
    parentCid = parentCid || 0;
    const cids = categories.map(category => category && category.cid);
    const cidToCategory = {};
    const parents = {};
    cids.forEach((cid, index) => {
        if (cid) {
            categories[index].children = undefined;
            cidToCategory[cid] = categories[index];
            parents[cid] = Object.assign({}, categories[index]);
        }
    });
    const tree = [];
    categories.forEach((category) => {
        if (category) {
            category.children = category.children || [];
            if (!category.cid) {
                return;
            }
            if (!category.hasOwnProperty('parentCid') || category.parentCid === null) {
                category.parentCid = 0;
            }
            if (category.parentCid === parentCid) {
                tree.push(category);
                category.parent = parents[parentCid];
            }
            else {
                const parent = cidToCategory[category.parentCid];
                if (parent && parent.cid !== category.cid) {
                    category.parent = parents[category.parentCid];
                    parent.children = parent.children || [];
                    parent.children.push(category);
                }
            }
        }
    });
    function sortTree(tree) {
        tree.sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            return a.cid - b.cid;
        });
        tree.forEach((category) => {
            if (category && Array.isArray(category.children)) {
                sortTree(category.children);
            }
        });
    }
    sortTree(tree);
    categories.forEach(c => calculateTopicPostCount(c));
    return tree;
};
Categories.buildForSelect = function (uid, privilege, fields) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield Categories.getCidsByPrivilege('categories:cid', uid, privilege);
        return yield getSelectData(cids, fields);
    });
};
Categories.buildForSelectAll = function (fields) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield Categories.getAllCidsFromSet('categories:cid');
        return yield getSelectData(cids, fields);
    });
};
function getSelectData(cids, fields) {
    return __awaiter(this, void 0, void 0, function* () {
        const categoryData = yield Categories.getCategoriesData(cids);
        const tree = Categories.getTree(categoryData);
        return Categories.buildForSelectCategories(tree, fields);
    });
}
Categories.buildForSelectCategories = function (categories, fields, parentCid) {
    function recursive(category, categoriesData, level, depth) {
        const bullet = level ? '&bull; ' : '';
        category.value = category.cid;
        category.level = level;
        category.text = level + bullet + category.name;
        category.depth = depth;
        categoriesData.push(category);
        if (Array.isArray(category.children)) {
            category.children.forEach(child => recursive(child, categoriesData, `&nbsp;&nbsp;&nbsp;&nbsp;${level}`, depth + 1));
        }
    }
    parentCid = parentCid || 0;
    const categoriesData = [];
    const rootCategories = categories.filter(category => category && category.parentCid === parentCid);
    rootCategories.forEach(category => recursive(category, categoriesData, '', 0));
    const pickFields = [
        'cid', 'name', 'level', 'icon', 'parentCid',
        'color', 'bgColor', 'backgroundImage', 'imageClass',
    ];
    fields = fields || [];
    if (fields.includes('text') && fields.includes('value')) {
        return categoriesData.map(category => _.pick(category, fields));
    }
    if (fields.length) {
        pickFields.push(...fields);
    }
    return categoriesData.map(category => _.pick(category, pickFields));
};
require('../promisify').promisify(Categories);
exports.default = Categories;
