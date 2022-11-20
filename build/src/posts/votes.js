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
const meta_1 = __importDefault(require("../meta"));
const database_1 = __importDefault(require("../database"));
const flags = require('../flags');
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const plugins = require('../plugins');
const privileges = require('../privileges');
const translator = require('../translator');
function default_1(Posts) {
    const votesInProgress = {};
    Posts.upvote = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config['reputation:disabled']) {
                throw new Error('[[error:reputation-system-disabled]]');
            }
            const canUpvote = yield privileges.posts.can('posts:upvote', pid, uid);
            if (!canUpvote) {
                throw new Error('[[error:no-privileges]]');
            }
            if (voteInProgress(pid, uid)) {
                throw new Error('[[error:already-voting-for-this-post]]');
            }
            putVoteInProgress(pid, uid);
            try {
                return yield toggleVote('upvote', pid, uid);
            }
            finally {
                clearVoteProgress(pid, uid);
            }
        });
    };
    Posts.downvote = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config['reputation:disabled']) {
                throw new Error('[[error:reputation-system-disabled]]');
            }
            if (meta_1.default.config['downvote:disabled']) {
                throw new Error('[[error:downvoting-disabled]]');
            }
            const canDownvote = yield privileges.posts.can('posts:downvote', pid, uid);
            if (!canDownvote) {
                throw new Error('[[error:no-privileges]]');
            }
            if (voteInProgress(pid, uid)) {
                throw new Error('[[error:already-voting-for-this-post]]');
            }
            putVoteInProgress(pid, uid);
            try {
                return yield toggleVote('downvote', pid, uid);
            }
            finally {
                clearVoteProgress(pid, uid);
            }
        });
    };
    Posts.unvote = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (voteInProgress(pid, uid)) {
                throw new Error('[[error:already-voting-for-this-post]]');
            }
            putVoteInProgress(pid, uid);
            try {
                const voteStatus = yield Posts.hasVoted(pid, uid);
                return yield unvote(pid, uid, 'unvote', voteStatus);
            }
            finally {
                clearVoteProgress(pid, uid);
            }
        });
    };
    Posts.hasVoted = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return { upvoted: false, downvoted: false };
            }
            const hasVoted = yield database_1.default.isMemberOfSets([`pid:${pid}:upvote`, `pid:${pid}:downvote`], uid);
            return { upvoted: hasVoted[0], downvoted: hasVoted[1] };
        });
    };
    Posts.getVoteStatusByPostIDs = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                const data = pids.map(() => false);
                return { upvotes: data, downvotes: data };
            }
            const upvoteSets = pids.map(pid => `pid:${pid}:upvote`);
            const downvoteSets = pids.map(pid => `pid:${pid}:downvote`);
            const data = yield database_1.default.isMemberOfSets(upvoteSets.concat(downvoteSets), uid);
            return {
                upvotes: data.slice(0, pids.length),
                downvotes: data.slice(pids.length, pids.length * 2),
            };
        });
    };
    Posts.getUpvotedUidsByPids = function (pids) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSetsMembers(pids.map(pid => `pid:${pid}:upvote`));
        });
    };
    function voteInProgress(pid, uid) {
        return Array.isArray(votesInProgress[uid]) && votesInProgress[uid].includes(parseInt(pid, 10));
    }
    function putVoteInProgress(pid, uid) {
        votesInProgress[uid] = votesInProgress[uid] || [];
        votesInProgress[uid].push(parseInt(pid, 10));
    }
    function clearVoteProgress(pid, uid) {
        if (Array.isArray(votesInProgress[uid])) {
            const index = votesInProgress[uid].indexOf(parseInt(pid, 10));
            if (index !== -1) {
                votesInProgress[uid].splice(index, 1);
            }
        }
    }
    function toggleVote(type, pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const voteStatus = yield Posts.hasVoted(pid, uid);
            yield unvote(pid, uid, type, voteStatus);
            return yield vote(type, false, pid, uid, voteStatus);
        });
    }
    function unvote(pid, uid, type, voteStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            const owner = yield Posts.getPostField(pid, 'uid');
            if (parseInt(uid, 10) === parseInt(owner, 10)) {
                throw new Error('[[error:self-vote]]');
            }
            if (type === 'downvote' || type === 'upvote') {
                yield checkVoteLimitation(pid, uid, type);
            }
            if (!voteStatus || (!voteStatus.upvoted && !voteStatus.downvoted)) {
                return;
            }
            return yield vote(voteStatus.upvoted ? 'downvote' : 'upvote', true, pid, uid, voteStatus);
        });
    }
    function checkVoteLimitation(pid, uid, type) {
        return __awaiter(this, void 0, void 0, function* () {
            // type = 'upvote' or 'downvote'
            const oneDay = 86400000;
            const [reputation, targetUid, votedPidsToday] = yield Promise.all([
                user_1.default.getUserField(uid, 'reputation'),
                Posts.getPostField(pid, 'uid'),
                database_1.default.getSortedSetRevRangeByScore(`uid:${uid}:${type}`, 0, -1, '+inf', Date.now() - oneDay),
            ]);
            if (reputation < meta_1.default.config[`min:rep:${type}`]) {
                throw new Error(`[[error:not-enough-reputation-to-${type}, ${meta_1.default.config[`min:rep:${type}`]}]]`);
            }
            const votesToday = meta_1.default.config[`${type}sPerDay`];
            if (votesToday && votedPidsToday.length >= votesToday) {
                throw new Error(`[[error:too-many-${type}s-today, ${votesToday}]]`);
            }
            const voterPerUserToday = meta_1.default.config[`${type}sPerUserPerDay`];
            if (voterPerUserToday) {
                const postData = yield Posts.getPostsFields(votedPidsToday, ['uid']);
                const targetUpVotes = postData.filter(p => p.uid === targetUid).length;
                if (targetUpVotes >= voterPerUserToday) {
                    throw new Error(`[[error:too-many-${type}s-today-user, ${voterPerUserToday}]]`);
                }
            }
        });
    }
    function vote(type, unvote, pid, uid, voteStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            uid = parseInt(uid, 10);
            if (uid <= 0) {
                throw new Error('[[error:not-logged-in]]');
            }
            const now = Date.now();
            if (type === 'upvote' && !unvote) {
                yield database_1.default.sortedSetAdd(`uid:${uid}:upvote`, now, pid);
            }
            else {
                yield database_1.default.sortedSetRemove(`uid:${uid}:upvote`, pid);
            }
            if (type === 'upvote' || unvote) {
                yield database_1.default.sortedSetRemove(`uid:${uid}:downvote`, pid);
            }
            else {
                yield database_1.default.sortedSetAdd(`uid:${uid}:downvote`, now, pid);
            }
            const postData = yield Posts.getPostFields(pid, ['pid', 'uid', 'tid']);
            const newReputation = yield user_1.default.incrementUserReputationBy(postData.uid, type === 'upvote' ? 1 : -1);
            yield adjustPostVotes(postData, uid, type, unvote);
            yield fireVoteHook(postData, uid, type, unvote, voteStatus);
            return {
                user: {
                    reputation: newReputation,
                },
                fromuid: uid,
                post: postData,
                upvote: type === 'upvote' && !unvote,
                downvote: type === 'downvote' && !unvote,
            };
        });
    }
    function fireVoteHook(postData, uid, type, unvote, voteStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            let hook = type;
            let current = voteStatus.upvoted ? 'upvote' : 'downvote';
            if (unvote) { // e.g. unvoting, removing a upvote or downvote
                hook = 'unvote';
            }
            else { // e.g. User *has not* voted, clicks upvote or downvote
                current = 'unvote';
            }
            // action:post.upvote
            // action:post.downvote
            // action:post.unvote
            plugins.hooks.fire(`action:post.${hook}`, {
                pid: postData.pid,
                uid: uid,
                owner: postData.uid,
                current: current,
            });
        });
    }
    function adjustPostVotes(postData, uid, type, unvote) {
        return __awaiter(this, void 0, void 0, function* () {
            const notType = (type === 'upvote' ? 'downvote' : 'upvote');
            if (unvote) {
                yield database_1.default.setRemove(`pid:${postData.pid}:${type}`, uid);
            }
            else {
                yield database_1.default.setAdd(`pid:${postData.pid}:${type}`, uid);
            }
            yield database_1.default.setRemove(`pid:${postData.pid}:${notType}`, uid);
            const [upvotes, downvotes] = yield Promise.all([
                database_1.default.setCount(`pid:${postData.pid}:upvote`),
                database_1.default.setCount(`pid:${postData.pid}:downvote`),
            ]);
            postData.upvotes = upvotes;
            postData.downvotes = downvotes;
            postData.votes = postData.upvotes - postData.downvotes;
            yield Posts.updatePostVoteCount(postData);
        });
    }
    Posts.updatePostVoteCount = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!postData || !postData.pid || !postData.tid) {
                return;
            }
            const threshold = meta_1.default.config['flags:autoFlagOnDownvoteThreshold'];
            if (threshold && postData.votes <= (-threshold)) {
                const adminUid = yield user_1.default.getFirstAdminUid();
                const reportMsg = yield translator.translate(`[[flags:auto-flagged, ${-postData.votes}]]`);
                const flagObj = yield flags.create('post', postData.pid, adminUid, reportMsg, null, true);
                yield flags.notify(flagObj, adminUid, true);
            }
            yield Promise.all([
                updateTopicVoteCount(postData),
                database_1.default.sortedSetAdd('posts:votes', postData.votes, postData.pid),
                Posts.setPostFields(postData.pid, {
                    upvotes: postData.upvotes,
                    downvotes: postData.downvotes,
                }),
            ]);
            plugins.hooks.fire('action:post.updatePostVoteCount', { post: postData });
        });
    };
    function updateTopicVoteCount(postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield topics.getTopicFields(postData.tid, ['mainPid', 'cid', 'pinned']);
            if (postData.uid) {
                if (postData.votes !== 0) {
                    yield database_1.default.sortedSetAdd(`cid:${topicData.cid}:uid:${postData.uid}:pids:votes`, postData.votes, postData.pid);
                }
                else {
                    yield database_1.default.sortedSetRemove(`cid:${topicData.cid}:uid:${postData.uid}:pids:votes`, postData.pid);
                }
            }
            if (parseInt(topicData.mainPid, 10) !== parseInt(postData.pid, 10)) {
                return yield database_1.default.sortedSetAdd(`tid:${postData.tid}:posts:votes`, postData.votes, postData.pid);
            }
            const promises = [
                topics.setTopicFields(postData.tid, {
                    upvotes: postData.upvotes,
                    downvotes: postData.downvotes,
                }),
                database_1.default.sortedSetAdd('topics:votes', postData.votes, postData.tid),
            ];
            if (!topicData.pinned) {
                promises.push(database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, postData.votes, postData.tid));
            }
            yield Promise.all(promises);
        });
    }
}
exports.default = default_1;
;
