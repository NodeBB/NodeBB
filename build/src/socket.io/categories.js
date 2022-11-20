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
const categories = require('../categories');
const privileges = require('../privileges');
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const SocketCategories = {};
require('./categories/search').default(SocketCategories);
SocketCategories.getRecentReplies = function (socket, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield categories.getRecentReplies(cid, socket.uid, 0, 4);
    });
};
SocketCategories.get = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        function getCategories() {
            return __awaiter(this, void 0, void 0, function* () {
                const cids = yield categories.getCidsByPrivilege('categories:cid', socket.uid, 'find');
                return yield categories.getCategoriesData(cids);
            });
        }
        const [isAdmin, categoriesData] = yield Promise.all([
            user_1.default.isAdministrator(socket.uid),
            getCategories(),
        ]);
        return categoriesData.filter(category => category && (!category.disabled || isAdmin));
    });
};
SocketCategories.getWatchedCategories = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        const [categoriesData, ignoredCids] = yield Promise.all([
            categories.getCategoriesByPrivilege('cid:0:children', socket.uid, 'find'),
            user_1.default.getIgnoredCategories(socket.uid),
        ]);
        return categoriesData.filter(category => category && !ignoredCids.includes(String(category.cid)));
    });
};
SocketCategories.loadMore = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        data.query = data.query || {};
        const [userPrivileges, settings, targetUid] = yield Promise.all([
            privileges.categories.get(data.cid, socket.uid),
            user_1.default.getSettings(socket.uid),
            user_1.default.getUidByUserslug(data.query.author),
        ]);
        if (!userPrivileges.read) {
            throw new Error('[[error:no-privileges]]');
        }
        const infScrollTopicsPerPage = 20;
        const sort = data.sort || data.categoryTopicSort;
        let start = Math.max(0, parseInt(data.after, 10));
        if (data.direction === -1) {
            start -= infScrollTopicsPerPage;
        }
        let stop = start + infScrollTopicsPerPage - 1;
        start = Math.max(0, start);
        stop = Math.max(0, stop);
        const result = yield categories.getCategoryTopics({
            uid: socket.uid,
            cid: data.cid,
            start: start,
            stop: stop,
            sort: sort,
            settings: settings,
            query: data.query,
            tag: data.query.tag,
            targetUid: targetUid,
        });
        categories.modifyTopicsByPrivilege(result.topics, userPrivileges);
        result.privileges = userPrivileges;
        result.template = {
            category: true,
            name: 'category',
        };
        return result;
    });
};
SocketCategories.getTopicCount = function (socket, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield categories.getCategoryField(cid, 'topic_count');
    });
};
SocketCategories.getCategoriesByPrivilege = function (socket, privilege) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield categories.getCategoriesByPrivilege('categories:cid', socket.uid, privilege);
    });
};
SocketCategories.getMoveCategories = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield SocketCategories.getSelectCategories(socket, data);
    });
};
SocketCategories.getSelectCategories = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isAdmin, categoriesData] = yield Promise.all([
            user_1.default.isAdministrator(socket.uid),
            categories.buildForSelect(socket.uid, 'find', ['disabled', 'link']),
        ]);
        return categoriesData.filter(category => category && (!category.disabled || isAdmin) && !category.link);
    });
};
SocketCategories.setWatchState = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.cid || !data.state) {
            throw new Error('[[error:invalid-data]]');
        }
        return yield ignoreOrWatch((uid, cids) => __awaiter(this, void 0, void 0, function* () {
            yield user_1.default.setCategoryWatchState(uid, cids, categories.watchStates[data.state]);
        }), socket, data);
    });
};
SocketCategories.watch = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield ignoreOrWatch(user_1.default.watchCategory, socket, data);
    });
};
SocketCategories.ignore = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield ignoreOrWatch(user_1.default.ignoreCategory, socket, data);
    });
};
function ignoreOrWatch(fn, socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        let targetUid = socket.uid;
        const cids = Array.isArray(data.cid) ? data.cid.map((cid) => parseInt(cid, 10)) : [parseInt(data.cid, 10)];
        if (data.hasOwnProperty('uid')) {
            targetUid = data.uid;
        }
        yield user_1.default.isAdminOrGlobalModOrSelf(socket.uid, targetUid);
        const allCids = yield categories.getAllCidsFromSet('categories:cid');
        const categoryData = yield categories.getCategoriesFields(allCids, ['cid', 'parentCid']);
        // filter to subcategories of cid
        let cat;
        do {
            cat = categoryData.find(c => !cids.includes(c.cid) && cids.includes(c.parentCid));
            if (cat) {
                cids.push(cat.cid);
            }
        } while (cat);
        yield fn(targetUid, cids);
        yield topics.pushUnreadCount(targetUid);
        return cids;
    });
}
SocketCategories.isModerator = function (socket, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield user_1.default.isModerator(socket.uid, cid);
    });
};
SocketCategories.loadMoreSubCategories = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.cid || !(parseInt(data.start, 10) > 0)) {
            throw new Error('[[error:invalid-data]]');
        }
        const allowed = yield privileges.categories.can('read', data.cid, socket.uid);
        if (!allowed) {
            throw new Error('[[error:no-privileges]]');
        }
        const category = yield categories.getCategoryData(data.cid);
        yield categories.getChildrenTree(category, socket.uid);
        const allCategories = [];
        categories.flattenCategories(allCategories, category.children);
        yield categories.getRecentTopicReplies(allCategories, socket.uid);
        const start = parseInt(data.start, 10);
        return category.children.slice(start, start + category.subCategoriesPerPage);
    });
};
require('../promisify').promisify(SocketCategories);
