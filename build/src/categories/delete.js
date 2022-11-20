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
const database_1 = __importDefault(require("../database"));
const batch = require('../batch');
const plugins = require('../plugins');
const topics = require('../topics');
const groups = require('../groups');
const privileges = require('../privileges');
const cache = require('../cache');
function default_1(Categories) {
    Categories.purge = function (cid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet(`cid:${cid}:tids`, (tids) => __awaiter(this, void 0, void 0, function* () {
                yield async.eachLimit(tids, 10, (tid) => __awaiter(this, void 0, void 0, function* () {
                    yield topics.purgePostsAndTopic(tid, uid);
                }));
            }), { alwaysStartAt: 0 });
            const pinnedTids = yield database_1.default.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1);
            yield async.eachLimit(pinnedTids, 10, (tid) => __awaiter(this, void 0, void 0, function* () {
                yield topics.purgePostsAndTopic(tid, uid);
            }));
            const categoryData = yield Categories.getCategoryData(cid);
            yield purgeCategory(cid, categoryData);
            plugins.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
        });
    };
    function purgeCategory(cid, categoryData) {
        return __awaiter(this, void 0, void 0, function* () {
            const bulkRemove = [['categories:cid', cid]];
            if (categoryData && categoryData.name) {
                bulkRemove.push(['categories:name', `${categoryData.name.slice(0, 200).toLowerCase()}:${cid}`]);
            }
            yield database_1.default.sortedSetRemoveBulk(bulkRemove);
            yield removeFromParent(cid);
            yield deleteTags(cid);
            yield database_1.default.deleteAll([
                `cid:${cid}:tids`,
                `cid:${cid}:tids:pinned`,
                `cid:${cid}:tids:posts`,
                `cid:${cid}:tids:votes`,
                `cid:${cid}:tids:views`,
                `cid:${cid}:tids:lastposttime`,
                `cid:${cid}:recent_tids`,
                `cid:${cid}:pids`,
                `cid:${cid}:read_by_uid`,
                `cid:${cid}:uid:watch:state`,
                `cid:${cid}:children`,
                `cid:${cid}:tag:whitelist`,
                `category:${cid}`,
            ]);
            const privilegeList = yield privileges.categories.getPrivilegeList();
            yield groups.destroy(privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
        });
    }
    function removeFromParent(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [parentCid, children] = yield Promise.all([
                Categories.getCategoryField(cid, 'parentCid'),
                database_1.default.getSortedSetRange(`cid:${cid}:children`, 0, -1),
            ]);
            const bulkAdd = [];
            const childrenKeys = children.map((cid) => {
                bulkAdd.push(['cid:0:children', cid, cid]);
                return `category:${cid}`;
            });
            yield Promise.all([
                database_1.default.sortedSetRemove(`cid:${parentCid}:children`, cid),
                database_1.default.setObjectField(childrenKeys, 'parentCid', 0),
                database_1.default.sortedSetAddBulk(bulkAdd),
            ]);
            cache.del([
                'categories:cid',
                'cid:0:children',
                `cid:${parentCid}:children`,
                `cid:${parentCid}:children:all`,
                `cid:${cid}:children`,
                `cid:${cid}:children:all`,
                `cid:${cid}:tag:whitelist`,
            ]);
        });
    }
    function deleteTags(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const tags = yield database_1.default.getSortedSetMembers(`cid:${cid}:tags`);
            yield database_1.default.deleteAll(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
            yield database_1.default.delete(`cid:${cid}:tags`);
        });
    }
}
exports.default = default_1;
;
