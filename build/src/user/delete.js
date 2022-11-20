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
const _ = require('lodash');
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const util = require('util');
const rimrafAsync = util.promisify(require('rimraf'));
const database_1 = __importDefault(require("../database"));
const posts = require('../posts');
const flags = require('../flags');
const topics = require('../topics');
const groups = require('../groups');
const messaging = require('../messaging');
const plugins = require('../plugins');
const batch = require('../batch');
function default_1(User) {
    const deletesInProgress = {};
    User.delete = (callerUid, uid) => __awaiter(this, void 0, void 0, function* () {
        yield User.deleteContent(callerUid, uid);
        return yield User.deleteAccount(uid);
    });
    User.deleteContent = function (callerUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                throw new Error('[[error:invalid-uid]]');
            }
            if (deletesInProgress[uid]) {
                throw new Error('[[error:already-deleting]]');
            }
            deletesInProgress[uid] = 'user.delete';
            yield deletePosts(callerUid, uid);
            yield deleteTopics(callerUid, uid);
            yield deleteUploads(callerUid, uid);
            yield deleteQueued(uid);
            delete deletesInProgress[uid];
        });
    };
    function deletePosts(callerUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet(`uid:${uid}:posts`, (pids) => __awaiter(this, void 0, void 0, function* () {
                yield posts.purge(pids, callerUid);
            }), { alwaysStartAt: 0, batch: 500 });
        });
    }
    function deleteTopics(callerUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet(`uid:${uid}:topics`, (ids) => __awaiter(this, void 0, void 0, function* () {
                yield async.eachSeries(ids, (tid) => __awaiter(this, void 0, void 0, function* () {
                    yield topics.purge(tid, callerUid);
                }));
            }), { alwaysStartAt: 0 });
        });
    }
    function deleteUploads(callerUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const uploads = yield database_1.default.getSortedSetMembers(`uid:${uid}:uploads`);
            yield User.deleteUpload(callerUid, uid, uploads);
        });
    }
    function deleteQueued(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            let deleteIds = [];
            yield batch.processSortedSet('post:queue', (ids) => __awaiter(this, void 0, void 0, function* () {
                const data = yield database_1.default.getObjects(ids.map(id => `post:queue:${id}`));
                const userQueuedIds = data.filter((d) => parseInt(d.uid, 10) === parseInt(uid, 10)).map((d) => d.id);
                deleteIds = deleteIds.concat(userQueuedIds);
            }), { batch: 500 });
            yield async.eachSeries(deleteIds, posts.removeFromQueue);
        });
    }
    function removeFromSortedSets(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.sortedSetsRemove([
                'users:joindate',
                'users:postcount',
                'users:reputation',
                'users:banned',
                'users:banned:expire',
                'users:flags',
                'users:online',
                'digest:day:uids',
                'digest:week:uids',
                'digest:biweek:uids',
                'digest:month:uids',
            ], uid);
        });
    }
    User.deleteAccount = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (deletesInProgress[uid] === 'user.deleteAccount') {
                throw new Error('[[error:already-deleting]]');
            }
            deletesInProgress[uid] = 'user.deleteAccount';
            yield removeFromSortedSets(uid);
            const userData = yield database_1.default.getObject(`user:${uid}`);
            if (!userData || !userData.username) {
                delete deletesInProgress[uid];
                throw new Error('[[error:no-user]]');
            }
            yield plugins.hooks.fire('static:user.delete', { uid: uid, userData: userData });
            yield deleteVotes(uid);
            yield deleteChats(uid);
            yield User.auth.revokeAllSessions(uid);
            const keys = [
                `uid:${uid}:notifications:read`,
                `uid:${uid}:notifications:unread`,
                `uid:${uid}:bookmarks`,
                `uid:${uid}:tids_read`,
                `uid:${uid}:tids_unread`,
                `uid:${uid}:followed_tids`,
                `uid:${uid}:ignored_tids`,
                `uid:${uid}:blocked_uids`,
                `user:${uid}:settings`,
                `user:${uid}:usernames`,
                `user:${uid}:emails`,
                `uid:${uid}:topics`, `uid:${uid}:posts`,
                `uid:${uid}:chats`, `uid:${uid}:chats:unread`,
                `uid:${uid}:chat:rooms`, `uid:${uid}:chat:rooms:unread`,
                `uid:${uid}:upvote`, `uid:${uid}:downvote`,
                `uid:${uid}:flag:pids`,
                `uid:${uid}:sessions`, `uid:${uid}:sessionUUID:sessionId`,
                `invitation:uid:${uid}`,
            ];
            const bulkRemove = [
                ['username:uid', userData.username],
                ['username:sorted', `${userData.username.toLowerCase()}:${uid}`],
                ['userslug:uid', userData.userslug],
                ['fullname:uid', userData.fullname],
            ];
            if (userData.email) {
                bulkRemove.push(['email:uid', userData.email.toLowerCase()]);
                bulkRemove.push(['email:sorted', `${userData.email.toLowerCase()}:${uid}`]);
            }
            if (userData.fullname) {
                bulkRemove.push(['fullname:sorted', `${userData.fullname.toLowerCase()}:${uid}`]);
            }
            yield Promise.all([
                database_1.default.sortedSetRemoveBulk(bulkRemove),
                database_1.default.decrObjectField('global', 'userCount'),
                database_1.default.deleteAll(keys),
                database_1.default.setRemove('invitation:uids', uid),
                deleteUserIps(uid),
                deleteUserFromFollowers(uid),
                deleteImages(uid),
                groups.leaveAllGroups(uid),
                flags.resolveFlag('user', uid, uid),
                User.reset.cleanByUid(uid),
            ]);
            yield database_1.default.deleteAll([`followers:${uid}`, `following:${uid}`, `user:${uid}`]);
            delete deletesInProgress[uid];
            return userData;
        });
    };
    function deleteVotes(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [upvotedPids, downvotedPids] = yield Promise.all([
                database_1.default.getSortedSetRange(`uid:${uid}:upvote`, 0, -1),
                database_1.default.getSortedSetRange(`uid:${uid}:downvote`, 0, -1),
            ]);
            const pids = _.uniq(upvotedPids.concat(downvotedPids).filter(Boolean));
            yield async.eachSeries(pids, (pid) => __awaiter(this, void 0, void 0, function* () {
                yield posts.unvote(pid, uid);
            }));
        });
    }
    function deleteChats(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomIds = yield database_1.default.getSortedSetRange(`uid:${uid}:chat:rooms`, 0, -1);
            const userKeys = roomIds.map(roomId => `uid:${uid}:chat:room:${roomId}:mids`);
            yield Promise.all([
                messaging.leaveRooms(uid, roomIds),
                database_1.default.deleteAll(userKeys),
            ]);
        });
    }
    function deleteUserIps(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const ips = yield database_1.default.getSortedSetRange(`uid:${uid}:ip`, 0, -1);
            yield database_1.default.sortedSetsRemove(ips.map(ip => `ip:${ip}:uid`), uid);
            yield database_1.default.delete(`uid:${uid}:ip`);
        });
    }
    function deleteUserFromFollowers(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [followers, following] = yield Promise.all([
                database_1.default.getSortedSetRange(`followers:${uid}`, 0, -1),
                database_1.default.getSortedSetRange(`following:${uid}`, 0, -1),
            ]);
            function updateCount(uids, name, fieldName) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield async.each(uids, (uid) => __awaiter(this, void 0, void 0, function* () {
                        let count = yield database_1.default.sortedSetCard(name + uid);
                        count = parseInt(count, 10) || 0;
                        yield database_1.default.setObjectField(`user:${uid}`, fieldName, count);
                    }));
                });
            }
            const followingSets = followers.map(uid => `following:${uid}`);
            const followerSets = following.map(uid => `followers:${uid}`);
            yield Promise.all([
                database_1.default.sortedSetsRemove(followerSets.concat(followingSets), uid),
                updateCount(following, 'followers:', 'followerCount'),
                updateCount(followers, 'following:', 'followingCount'),
            ]);
        });
    }
    function deleteImages(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const folder = path_1.default.join(nconf_1.default.get('upload_path'), 'profile');
            yield Promise.all([
                rimrafAsync(path_1.default.join(folder, `${uid}-profilecover*`)),
                rimrafAsync(path_1.default.join(folder, `${uid}-profileavatar*`)),
            ]);
        });
    }
}
exports.default = default_1;
;
