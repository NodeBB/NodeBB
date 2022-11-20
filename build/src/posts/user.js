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
const validator = require('validator');
const _ = require('lodash');
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const groups = require('../groups');
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const privileges = require('../privileges');
function default_1(Posts) {
    Posts.getUserInfoForPosts = function (uids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [userData, userSettings, signatureUids] = yield Promise.all([
                getUserData(uids, uid),
                user_1.default.getMultipleUserSettings(uids),
                privileges.global.filterUids('signature', uids),
            ]);
            const uidsSignatureSet = new Set(signatureUids.map(uid => parseInt(uid, 10)));
            const groupsMap = yield getGroupsMap(userData);
            userData.forEach((userData, index) => {
                userData.signature = validator.escape(String(userData.signature || ''));
                userData.fullname = userSettings[index].showfullname ? validator.escape(String(userData.fullname || '')) : undefined;
                userData.selectedGroups = [];
                if (meta_1.default.config.hideFullname) {
                    userData.fullname = undefined;
                }
            });
            const result = yield Promise.all(userData.map((userData) => __awaiter(this, void 0, void 0, function* () {
                const [isMemberOfGroups, signature, customProfileInfo] = yield Promise.all([
                    checkGroupMembership(userData.uid, userData.groupTitleArray),
                    parseSignature(userData, uid, uidsSignatureSet),
                    plugins.hooks.fire('filter:posts.custom_profile_info', { profile: [], uid: userData.uid }),
                ]);
                if (isMemberOfGroups && userData.groupTitleArray) {
                    userData.groupTitleArray.forEach((userGroup, index) => {
                        if (isMemberOfGroups[index] && groupsMap[userGroup]) {
                            userData.selectedGroups.push(groupsMap[userGroup]);
                        }
                    });
                }
                userData.signature = signature;
                userData.custom_profile_info = customProfileInfo.profile;
                return yield plugins.hooks.fire('filter:posts.modifyUserInfo', userData);
            })));
            const hookResult = yield plugins.hooks.fire('filter:posts.getUserInfoForPosts', { users: result });
            return hookResult.users;
        });
    };
    Posts.overrideGuestHandle = function (postData, handle) {
        if (meta_1.default.config.allowGuestHandles && postData && postData.user && parseInt(postData.uid, 10) === 0 && handle) {
            postData.user.username = validator.escape(String(handle));
            if (postData.user.hasOwnProperty('fullname')) {
                postData.user.fullname = postData.user.username;
            }
            postData.user.displayname = postData.user.username;
        }
    };
    function checkGroupMembership(uid, groupTitleArray) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(groupTitleArray) || !groupTitleArray.length) {
                return null;
            }
            return yield groups.isMemberOfGroups(uid, groupTitleArray);
        });
    }
    function parseSignature(userData, uid, signatureUids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userData.signature || !signatureUids.has(userData.uid) || meta_1.default.config.disableSignatures) {
                return '';
            }
            const result = yield Posts.parseSignature(userData, uid);
            return result.userData.signature;
        });
    }
    function getGroupsMap(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupTitles = _.uniq(_.flatten(userData.map(u => u && u.groupTitleArray)));
            const groupsMap = {};
            const groupsData = yield groups.getGroupsData(groupTitles);
            groupsData.forEach((group) => {
                if (group && group.userTitleEnabled && !group.hidden) {
                    groupsMap[group.name] = {
                        name: group.name,
                        slug: group.slug,
                        labelColor: group.labelColor,
                        textColor: group.textColor,
                        icon: group.icon,
                        userTitle: group.userTitle,
                    };
                }
            });
            return groupsMap;
        });
    }
    function getUserData(uids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const fields = [
                'uid', 'username', 'fullname', 'userslug',
                'reputation', 'postcount', 'topiccount', 'picture',
                'signature', 'banned', 'banned:expire', 'status',
                'lastonline', 'groupTitle', 'mutedUntil',
            ];
            const result = yield plugins.hooks.fire('filter:posts.addUserFields', {
                fields: fields,
                uid: uid,
                uids: uids,
            });
            return yield user_1.default.getUsersFields(result.uids, _.uniq(result.fields));
        });
    }
    Posts.isOwner = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            uid = parseInt(uid, 10);
            const isArray = Array.isArray(pids);
            pids = isArray ? pids : [pids];
            if (uid <= 0) {
                return isArray ? pids.map(() => false) : false;
            }
            const postData = yield Posts.getPostsFields(pids, ['uid']);
            const result = postData.map(post => post && post.uid === uid);
            return isArray ? result : result[0];
        });
    };
    Posts.isModerator = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return pids.map(() => false);
            }
            const cids = yield Posts.getCidsByPids(pids);
            return yield user_1.default.isModerator(uid, cids);
        });
    };
    Posts.changeOwner = function (pids, toUid) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield user_1.default.exists(toUid);
            if (!exists) {
                throw new Error('[[error:no-user]]');
            }
            let postData = yield Posts.getPostsFields(pids, [
                'pid', 'tid', 'uid', 'content', 'deleted', 'timestamp', 'upvotes', 'downvotes',
            ]);
            postData = postData.filter(p => p.pid && p.uid !== parseInt(toUid, 10));
            pids = postData.map(p => p.pid);
            const cids = yield Posts.getCidsByPids(pids);
            const bulkRemove = [];
            const bulkAdd = [];
            let repChange = 0;
            const postsByUser = {};
            postData.forEach((post, i) => {
                post.cid = cids[i];
                repChange += post.votes;
                bulkRemove.push([`uid:${post.uid}:posts`, post.pid]);
                bulkRemove.push([`cid:${post.cid}:uid:${post.uid}:pids`, post.pid]);
                bulkRemove.push([`cid:${post.cid}:uid:${post.uid}:pids:votes`, post.pid]);
                bulkAdd.push([`uid:${toUid}:posts`, post.timestamp, post.pid]);
                bulkAdd.push([`cid:${post.cid}:uid:${toUid}:pids`, post.timestamp, post.pid]);
                if (post.votes > 0 || post.votes < 0) {
                    bulkAdd.push([`cid:${post.cid}:uid:${toUid}:pids:votes`, post.votes, post.pid]);
                }
                postsByUser[post.uid] = postsByUser[post.uid] || [];
                postsByUser[post.uid].push(post);
            });
            yield Promise.all([
                database_1.default.setObjectField(pids.map(pid => `post:${pid}`), 'uid', toUid),
                database_1.default.sortedSetRemoveBulk(bulkRemove),
                database_1.default.sortedSetAddBulk(bulkAdd),
                user_1.default.incrementUserReputationBy(toUid, repChange),
                handleMainPidOwnerChange(postData, toUid),
                updateTopicPosters(postData, toUid),
            ]);
            yield Promise.all([
                user_1.default.updatePostCount(toUid),
                reduceCounters(postsByUser),
            ]);
            plugins.hooks.fire('action:post.changeOwner', {
                posts: _.cloneDeep(postData),
                toUid: toUid,
            });
            return postData;
        });
    };
    function reduceCounters(postsByUser) {
        return __awaiter(this, void 0, void 0, function* () {
            yield async.eachOfSeries(postsByUser, (posts, uid) => __awaiter(this, void 0, void 0, function* () {
                const repChange = posts.reduce((acc, val) => acc + val.votes, 0);
                yield Promise.all([
                    user_1.default.updatePostCount(uid),
                    user_1.default.incrementUserReputationBy(uid, -repChange),
                ]);
            }));
        });
    }
    function updateTopicPosters(postData, toUid) {
        return __awaiter(this, void 0, void 0, function* () {
            const postsByTopic = _.groupBy(postData, p => parseInt(p.tid, 10));
            yield async.eachOf(postsByTopic, (posts, tid) => __awaiter(this, void 0, void 0, function* () {
                const postsByUser = _.groupBy(posts, p => parseInt(p.uid, 10));
                yield database_1.default.sortedSetIncrBy(`tid:${tid}:posters`, posts.length, toUid);
                yield async.eachOf(postsByUser, (posts, uid) => __awaiter(this, void 0, void 0, function* () {
                    yield database_1.default.sortedSetIncrBy(`tid:${tid}:posters`, -posts.length, uid);
                }));
            }));
        });
    }
    function handleMainPidOwnerChange(postData, toUid) {
        return __awaiter(this, void 0, void 0, function* () {
            const tids = _.uniq(postData.map(p => p.tid));
            const topicData = yield topics.getTopicsFields(tids, [
                'tid', 'cid', 'deleted', 'title', 'uid', 'mainPid', 'timestamp',
            ]);
            const tidToTopic = _.zipObject(tids, topicData);
            const mainPosts = postData.filter(p => p.pid === tidToTopic[p.tid].mainPid);
            if (!mainPosts.length) {
                return;
            }
            const bulkAdd = [];
            const bulkRemove = [];
            const postsByUser = {};
            mainPosts.forEach((post) => {
                bulkRemove.push([`cid:${post.cid}:uid:${post.uid}:tids`, post.tid]);
                bulkRemove.push([`uid:${post.uid}:topics`, post.tid]);
                bulkAdd.push([`cid:${post.cid}:uid:${toUid}:tids`, tidToTopic[post.tid].timestamp, post.tid]);
                bulkAdd.push([`uid:${toUid}:topics`, tidToTopic[post.tid].timestamp, post.tid]);
                postsByUser[post.uid] = postsByUser[post.uid] || [];
                postsByUser[post.uid].push(post);
            });
            yield Promise.all([
                database_1.default.setObjectField(mainPosts.map(p => `topic:${p.tid}`), 'uid', toUid),
                database_1.default.sortedSetRemoveBulk(bulkRemove),
                database_1.default.sortedSetAddBulk(bulkAdd),
                user_1.default.incrementUserFieldBy(toUid, 'topiccount', mainPosts.length),
                reduceTopicCounts(postsByUser),
            ]);
            const changedTopics = mainPosts.map(p => tidToTopic[p.tid]);
            plugins.hooks.fire('action:topic.changeOwner', {
                topics: _.cloneDeep(changedTopics),
                toUid: toUid,
            });
        });
    }
    function reduceTopicCounts(postsByUser) {
        return __awaiter(this, void 0, void 0, function* () {
            yield async.eachSeries(Object.keys(postsByUser), (uid) => __awaiter(this, void 0, void 0, function* () {
                const posts = postsByUser[uid];
                const exists = yield user_1.default.exists(uid);
                if (exists) {
                    yield user_1.default.incrementUserFieldBy(uid, 'topiccount', -posts.length);
                }
            }));
        });
    }
}
exports.default = default_1;
;
