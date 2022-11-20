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
const _ = require('lodash');
const winston_1 = __importDefault(require("winston"));
const validator = require('validator');
const db = require('./database');
const user = require('./user');
const groups = require('./groups');
const meta = require('./meta');
const notifications = require('./notifications');
const analytics = require('./analytics');
const categories = require('./categories');
const topics = require('./topics');
const posts = require('./posts');
const privileges = require('./privileges');
const plugins = require('./plugins');
const utils = require('./utils');
const batch = require('./batch');
const Flags = {};
Flags._constants = {
    states: ['open', 'wip', 'resolved', 'rejected'],
    state_class: {
        open: 'info',
        wip: 'warning',
        resolved: 'success',
        rejected: 'danger',
    },
};
Flags.init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        // Query plugins for custom filter strategies and merge into core filter strategies
        function prepareSets(sets, orSets, prefix, value) {
            if (!Array.isArray(value)) {
                sets.push(prefix + value);
            }
            else if (value.length) {
                if (value.length === 1) {
                    sets.push(prefix + value[0]);
                }
                else {
                    orSets.push(value.map(x => prefix + x));
                }
            }
        }
        const hookData = {
            filters: {
                type: function (sets, orSets, key) {
                    prepareSets(sets, orSets, 'flags:byType:', key);
                },
                state: function (sets, orSets, key) {
                    prepareSets(sets, orSets, 'flags:byState:', key);
                },
                reporterId: function (sets, orSets, key) {
                    prepareSets(sets, orSets, 'flags:byReporter:', key);
                },
                assignee: function (sets, orSets, key) {
                    prepareSets(sets, orSets, 'flags:byAssignee:', key);
                },
                targetUid: function (sets, orSets, key) {
                    prepareSets(sets, orSets, 'flags:byTargetUid:', key);
                },
                cid: function (sets, orSets, key) {
                    prepareSets(sets, orSets, 'flags:byCid:', key);
                },
                page: function () { },
                perPage: function () { },
                quick: function (sets, orSets, key, uid) {
                    switch (key) {
                        case 'mine':
                            sets.push(`flags:byAssignee:${uid}`);
                            break;
                        case 'unresolved':
                            prepareSets(sets, orSets, 'flags:byState:', ['open', 'wip']);
                            break;
                    }
                },
            },
            helpers: {
                prepareSets: prepareSets,
            },
        };
        try {
            const data = yield plugins.hooks.fire('filter:flags.getFilters', hookData);
            Flags._filters = data.filters;
        }
        catch (err) {
            winston_1.default.error(`[flags/init] Could not retrieve filters\n${err.stack}`);
            Flags._filters = {};
        }
    });
};
Flags.get = function (flagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const [base, notes, reports] = yield Promise.all([
            db.getObject(`flag:${flagId}`),
            Flags.getNotes(flagId),
            Flags.getReports(flagId),
        ]);
        if (!base) {
            return;
        }
        const flagObj = Object.assign(Object.assign({ state: 'open', assignee: null }, base), { datetimeISO: utils.toISOString(base.datetime), target_readable: `${base.type.charAt(0).toUpperCase() + base.type.slice(1)} ${base.targetId}`, target: yield Flags.getTarget(base.type, base.targetId, 0), notes,
            reports });
        const data = yield plugins.hooks.fire('filter:flags.get', {
            flag: flagObj,
        });
        return data.flag;
    });
};
Flags.getCount = function ({ uid, filters, query }) {
    return __awaiter(this, void 0, void 0, function* () {
        filters = filters || {};
        const flagIds = yield Flags.getFlagIdsWithFilters({ filters, uid, query });
        return flagIds.length;
    });
};
Flags.getFlagIdsWithFilters = function ({ filters, uid, query }) {
    return __awaiter(this, void 0, void 0, function* () {
        let sets = [];
        const orSets = [];
        // Default filter
        filters.page = filters.hasOwnProperty('page') ? Math.abs(parseInt(filters.page, 10) || 1) : 1;
        filters.perPage = filters.hasOwnProperty('perPage') ? Math.abs(parseInt(filters.perPage, 10) || 20) : 20;
        for (const type of Object.keys(filters)) {
            if (Flags._filters.hasOwnProperty(type)) {
                Flags._filters[type](sets, orSets, filters[type], uid);
            }
            else {
                winston_1.default.warn(`[flags/list] No flag filter type found: ${type}`);
            }
        }
        sets = (sets.length || orSets.length) ? sets : ['flags:datetime']; // No filter default
        let flagIds = [];
        if (sets.length === 1) {
            flagIds = yield db.getSortedSetRevRange(sets[0], 0, -1);
        }
        else if (sets.length > 1) {
            flagIds = yield db.getSortedSetRevIntersect({ sets: sets, start: 0, stop: -1, aggregate: 'MAX' });
        }
        if (orSets.length) {
            // @ts-ignore
            let _flagIds = yield Promise.all(orSets.map((orset) => __awaiter(this, void 0, void 0, function* () { return yield db.getSortedSetRevUnion({ sets: orSet, start: 0, stop: -1, aggregate: 'MAX' }); })));
            // Each individual orSet is ANDed together to construct the final list of flagIds
            _flagIds = _.intersection(..._flagIds);
            // Merge with flagIds returned by sets
            if (sets.length) {
                // If flag ids are already present, return a subset of flags that are in both sets
                flagIds = _.intersection(flagIds, _flagIds);
            }
            else {
                // Otherwise, return all flags returned via orSets
                flagIds = _.union(flagIds, _flagIds);
            }
        }
        const result = yield plugins.hooks.fire('filter:flags.getFlagIdsWithFilters', {
            filters,
            uid,
            query,
            flagIds,
        });
        return result.flagIds;
    });
};
Flags.list = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        const filters = data.filters || {};
        let flagIds = yield Flags.getFlagIdsWithFilters({
            filters,
            uid: data.uid,
            query: data.query,
        });
        flagIds = yield Flags.sort(flagIds, data.sort);
        // Create subset for parsing based on page number (n=20)
        const flagsPerPage = Math.abs(parseInt(filters.perPage, 10) || 1);
        const pageCount = Math.ceil(flagIds.length / flagsPerPage);
        flagIds = flagIds.slice((filters.page - 1) * flagsPerPage, filters.page * flagsPerPage);
        const reportCounts = yield db.sortedSetsCard(flagIds.map(flagId => `flag:${flagId}:reports`));
        const flags = yield Promise.all(flagIds.map((flagId, idx) => __awaiter(this, void 0, void 0, function* () {
            let flagObj = yield db.getObject(`flag:${flagId}`);
            flagObj = Object.assign({ state: 'open', assignee: null, heat: reportCounts[idx] }, flagObj);
            flagObj.labelClass = Flags._constants.state_class[flagObj.state];
            return Object.assign(flagObj, {
                target_readable: `${flagObj.type.charAt(0).toUpperCase() + flagObj.type.slice(1)} ${flagObj.targetId}`,
                datetimeISO: utils.toISOString(flagObj.datetime),
            });
        })));
        const payload = yield plugins.hooks.fire('filter:flags.list', {
            flags: flags,
            page: filters.page,
            uid: data.uid,
        });
        return {
            flags: payload.flags,
            page: payload.page,
            pageCount: pageCount,
        };
    });
};
Flags.sort = function (flagIds, sort) {
    return __awaiter(this, void 0, void 0, function* () {
        const filterPosts = (flagIds) => __awaiter(this, void 0, void 0, function* () {
            const keys = flagIds.map(id => `flag:${id}`);
            const types = yield db.getObjectsFields(keys, ['type']);
            return flagIds.filter((id, idx) => types[idx].type === 'post');
        });
        switch (sort) {
            // 'newest' is not handled because that is default
            case 'oldest':
                flagIds = flagIds.reverse();
                break;
            case 'reports': {
                const keys = flagIds.map(id => `flag:${id}:reports`);
                const heat = yield db.sortedSetsCard(keys);
                const mapped = heat.map((el, i) => ({
                    index: i, heat: el,
                }));
                mapped.sort((a, b) => b.heat - a.heat);
                flagIds = mapped.map(obj => flagIds[obj.index]);
                break;
            }
            case 'upvotes': // fall-through
            case 'downvotes':
            case 'replies': {
                flagIds = yield filterPosts(flagIds);
                const keys = flagIds.map(id => `flag:${id}`);
                const pids = (yield db.getObjectsFields(keys, ['targetId'])).map(obj => obj.targetId);
                const votes = (yield posts.getPostsFields(pids, [sort])).map(obj => parseInt(obj[sort], 10) || 0);
                const sortRef = flagIds.reduce((memo, cur, idx) => {
                    memo[cur] = votes[idx];
                    return memo;
                }, {});
                flagIds = flagIds.sort((a, b) => sortRef[b] - sortRef[a]);
            }
        }
        return flagIds;
    });
};
Flags.validate = function (payload) {
    return __awaiter(this, void 0, void 0, function* () {
        const [target, reporter] = yield Promise.all([
            Flags.getTarget(payload.type, payload.id, payload.uid),
            user.getUserData(payload.uid),
        ]);
        if (!target) {
            throw new Error('[[error:invalid-data]]');
        }
        else if (target.deleted) {
            throw new Error('[[error:post-deleted]]');
        }
        else if (!reporter || !reporter.userslug) {
            throw new Error('[[error:no-user]]');
        }
        else if (reporter.banned) {
            throw new Error('[[error:user-banned]]');
        }
        // Disallow flagging of profiles/content of privileged users
        const [targetPrivileged, reporterPrivileged] = yield Promise.all([
            user.isPrivileged(target.uid),
            user.isPrivileged(reporter.uid),
        ]);
        if (targetPrivileged && !reporterPrivileged) {
            throw new Error('[[error:cant-flag-privileged]]');
        }
        if (payload.type === 'post') {
            const editable = yield privileges.posts.canEdit(payload.id, payload.uid);
            if (!editable.flag && !meta.config['reputation:disabled'] && reporter.reputation < meta.config['min:rep:flag']) {
                throw new Error(`[[error:not-enough-reputation-to-flag, ${meta.config['min:rep:flag']}]]`);
            }
        }
        else if (payload.type === 'user') {
            if (parseInt(payload.id, 10) === parseInt(payload.uid, 10)) {
                throw new Error('[[error:cant-flag-self]]');
            }
            const editable = yield privileges.users.canEdit(payload.uid, payload.id);
            if (!editable && !meta.config['reputation:disabled'] && reporter.reputation < meta.config['min:rep:flag']) {
                throw new Error(`[[error:not-enough-reputation-to-flag, ${meta.config['min:rep:flag']}]]`);
            }
        }
        else {
            throw new Error('[[error:invalid-data]]');
        }
    });
};
Flags.getNotes = function (flagId) {
    return __awaiter(this, void 0, void 0, function* () {
        let notes = yield db.getSortedSetRevRangeWithScores(`flag:${flagId}:notes`, 0, -1);
        notes = yield modifyNotes(notes);
        return notes;
    });
};
Flags.getNote = function (flagId, datetime) {
    return __awaiter(this, void 0, void 0, function* () {
        datetime = parseInt(datetime, 10);
        if (isNaN(datetime)) {
            throw new Error('[[error:invalid-data]]');
        }
        let notes = yield db.getSortedSetRangeByScoreWithScores(`flag:${flagId}:notes`, 0, 1, datetime, datetime);
        if (!notes.length) {
            throw new Error('[[error:invalid-data]]');
        }
        notes = yield modifyNotes(notes);
        return notes[0];
    });
};
Flags.getFlagIdByTarget = function (type, id) {
    return __awaiter(this, void 0, void 0, function* () {
        let method;
        switch (type) {
            case 'post':
                method = posts.getPostField;
                break;
            case 'user':
                method = user.getUserField;
                break;
            default:
                throw new Error('[[error:invalid-data]]');
        }
        return yield method(id, 'flagId');
    });
};
function modifyNotes(notes) {
    return __awaiter(this, void 0, void 0, function* () {
        const uids = [];
        notes = notes.map((note) => {
            const noteObj = JSON.parse(note.value);
            uids.push(noteObj[0]);
            return {
                uid: noteObj[0],
                content: noteObj[1],
                datetime: note.score,
                datetimeISO: utils.toISOString(note.score),
            };
        });
        const userData = yield user.getUsersFields(uids, ['username', 'userslug', 'picture']);
        return notes.map((note, idx) => {
            note.user = userData[idx];
            note.content = validator.escape(note.content);
            return note;
        });
    });
}
Flags.deleteNote = function (flagId, datetime) {
    return __awaiter(this, void 0, void 0, function* () {
        datetime = parseInt(datetime, 10);
        if (isNaN(datetime)) {
            throw new Error('[[error:invalid-data]]');
        }
        const note = yield db.getSortedSetRangeByScore(`flag:${flagId}:notes`, 0, 1, datetime, datetime);
        if (!note.length) {
            throw new Error('[[error:invalid-data]]');
        }
        yield db.sortedSetRemove(`flag:${flagId}:notes`, note[0]);
    });
};
Flags.create = function (type, id, uid, reason, timestamp, forceFlag = false) {
    return __awaiter(this, void 0, void 0, function* () {
        let doHistoryAppend = false;
        if (!timestamp) {
            timestamp = Date.now();
            doHistoryAppend = true;
        }
        const [flagExists, targetExists, , targetFlagged, targetUid, targetCid] = yield Promise.all([
            // Sanity checks
            Flags.exists(type, id, uid),
            Flags.targetExists(type, id),
            Flags.canFlag(type, id, uid, forceFlag),
            Flags.targetFlagged(type, id),
            // Extra data for zset insertion
            Flags.getTargetUid(type, id),
            Flags.getTargetCid(type, id),
        ]);
        if (!forceFlag && flagExists) {
            throw new Error(`[[error:${type}-already-flagged]]`);
        }
        else if (!targetExists) {
            throw new Error('[[error:invalid-data]]');
        }
        // If the flag already exists, just add the report
        if (targetFlagged) {
            const flagId = yield Flags.getFlagIdByTarget(type, id);
            yield Promise.all([
                Flags.addReport(flagId, type, id, uid, reason, timestamp),
                Flags.update(flagId, uid, { state: 'open' }),
            ]);
            return yield Flags.get(flagId);
        }
        const flagId = yield db.incrObjectField('global', 'nextFlagId');
        const batched = [];
        batched.push(db.setObject(`flag:${flagId}`, {
            flagId: flagId,
            type: type,
            targetId: id,
            targetUid: targetUid,
            datetime: timestamp,
        }), Flags.addReport(flagId, type, id, uid, reason, timestamp), db.sortedSetAdd('flags:datetime', timestamp, flagId), // by time, the default
        db.sortedSetAdd(`flags:byType:${type}`, timestamp, flagId), // by flag type
        db.sortedSetIncrBy('flags:byTarget', 1, [type, id].join(':')), // by flag target (score is count)
        analytics.increment('flags') // some fancy analytics
        );
        if (targetUid) {
            batched.push(db.sortedSetAdd(`flags:byTargetUid:${targetUid}`, timestamp, flagId)); // by target uid
        }
        if (targetCid) {
            batched.push(db.sortedSetAdd(`flags:byCid:${targetCid}`, timestamp, flagId)); // by target cid
        }
        if (type === 'post') {
            batched.push(db.sortedSetAdd(`flags:byPid:${id}`, timestamp, flagId), // by target pid
            posts.setPostField(id, 'flagId', flagId));
            if (targetUid && parseInt(targetUid, 10) !== parseInt(uid, 10)) {
                batched.push(user.incrementUserFlagsBy(targetUid, 1));
            }
        }
        else if (type === 'user') {
            batched.push(user.setUserField(id, 'flagId', flagId));
        }
        // Run all the database calls in one single batched call...
        yield Promise.all(batched);
        if (doHistoryAppend) {
            yield Flags.update(flagId, uid, { state: 'open' });
        }
        const flagObj = yield Flags.get(flagId);
        plugins.hooks.fire('action:flags.create', { flag: flagObj });
        return flagObj;
    });
};
Flags.purge = function (flagIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const flagData = (yield db.getObjects(flagIds.map(flagId => `flag:${flagId}`))).filter(Boolean);
        const postFlags = flagData.filter(flagObj => flagObj.type === 'post');
        const userFlags = flagData.filter(flagObj => flagObj.type === 'user');
        const assignedFlags = flagData.filter(flagObj => !!flagObj.assignee);
        const [allReports, cids] = yield Promise.all([
            db.getSortedSetsMembers(flagData.map(flagObj => `flag:${flagObj.flagId}:reports`)),
            categories.getAllCidsFromSet('categories:cid'),
        ]);
        const allReporterUids = allReports.map(flagReports => flagReports.map(report => report && report.split(';')[0]));
        const removeReporters = [];
        flagData.forEach((flagObj, i) => {
            if (Array.isArray(allReporterUids[i])) {
                allReporterUids[i].forEach((uid) => {
                    removeReporters.push([`flags:hash`, [flagObj.type, flagObj.targetId, uid].join(':')]);
                    removeReporters.push([`flags:byReporter:${uid}`, flagObj.flagId]);
                });
            }
        });
        yield Promise.all([
            db.sortedSetRemoveBulk([
                ...flagData.map(flagObj => ([`flags:byType:${flagObj.type}`, flagObj.flagId])),
                ...flagData.map(flagObj => ([`flags:byState:${flagObj.state}`, flagObj.flagId])),
                ...removeReporters,
                ...postFlags.map(flagObj => ([`flags:byPid:${flagObj.targetId}`, flagObj.flagId])),
                ...assignedFlags.map(flagObj => ([`flags:byAssignee:${flagObj.assignee}`, flagObj.flagId])),
                ...userFlags.map(flagObj => ([`flags:byTargetUid:${flagObj.targetUid}`, flagObj.flagId])),
            ]),
            db.deleteObjectFields(postFlags.map(flagObj => `post:${flagObj.targetId}`, ['flagId'])),
            db.deleteObjectFields(userFlags.map(flagObj => `user:${flagObj.targetId}`, ['flagId'])),
            db.deleteAll([
                ...flagIds.map(flagId => `flag:${flagId}`),
                ...flagIds.map(flagId => `flag:${flagId}:notes`),
                ...flagIds.map(flagId => `flag:${flagId}:reports`),
                ...flagIds.map(flagId => `flag:${flagId}:history`),
            ]),
            db.sortedSetRemove(cids.map((cid) => `flags:byCid:${cid}`), flagIds),
            db.sortedSetRemove('flags:datetime', flagIds),
            db.sortedSetRemove('flags:byTarget', flagData.map(flagObj => [flagObj.type, flagObj.targetId].join(':'))),
        ]);
    });
};
Flags.getReports = function (flagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = yield db.getSortedSetRevRangeWithScores(`flag:${flagId}:reports`, 0, -1);
        const [reports, uids] = payload.reduce((memo, cur) => {
            const value = cur.value.split(';');
            memo[1].push(value.shift());
            cur.value = validator.escape(String(value.join(';')));
            memo[0].push(cur);
            return memo;
        }, [[], []]);
        yield Promise.all(reports.map((report, idx) => __awaiter(this, void 0, void 0, function* () {
            report.timestamp = report.score;
            report.timestampISO = new Date(report.score).toISOString();
            delete report.score;
            report.reporter = yield user.getUserFields(uids[idx], ['username', 'userslug', 'picture', 'reputation']);
        })));
        return reports;
    });
};
Flags.addReport = function (flagId, type, id, uid, reason, timestamp) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.sortedSetAddBulk([
            [`flags:byReporter:${uid}`, timestamp, flagId],
            [`flag:${flagId}:reports`, timestamp, [uid, reason].join(';')],
            ['flags:hash', flagId, [type, id, uid].join(':')],
        ]);
        plugins.hooks.fire('action:flags.addReport', { flagId, type, id, uid, reason, timestamp });
    });
};
Flags.exists = function (type, id, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db.isSortedSetMember('flags:hash', [type, id, uid].join(':'));
    });
};
Flags.canView = (flagId, uid) => __awaiter(void 0, void 0, void 0, function* () {
    const exists = yield db.isSortedSetMember('flags:datetime', flagId);
    if (!exists) {
        return false;
    }
    const [{ type, targetId }, isAdminOrGlobalMod] = yield Promise.all([
        db.getObject(`flag:${flagId}`),
        user.isAdminOrGlobalMod(uid),
    ]);
    if (type === 'post') {
        const cid = yield Flags.getTargetCid(type, targetId);
        const isModerator = yield user.isModerator(uid, cid);
        return isAdminOrGlobalMod || isModerator;
    }
    return isAdminOrGlobalMod;
});
Flags.canFlag = function (type, id, uid, skipLimitCheck = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const limit = meta.config['flags:limitPerTarget'];
        if (!skipLimitCheck && limit > 0) {
            const score = yield db.sortedSetScore('flags:byTarget', `${type}:${id}`);
            if (score >= limit) {
                throw new Error(`[[error:${type}-flagged-too-many-times]]`);
            }
        }
        const canRead = yield privileges.posts.can('topics:read', id, uid);
        switch (type) {
            case 'user':
                return true;
            case 'post':
                if (!canRead) {
                    throw new Error('[[error:no-privileges]]');
                }
                break;
            default:
                throw new Error('[[error:invalid-data]]');
        }
    });
};
Flags.getTarget = function (type, id, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (type === 'user') {
            const userData = yield user.getUserData(id);
            return userData && userData.uid ? userData : {};
        }
        if (type === 'post') {
            let postData = yield posts.getPostData(id);
            if (!postData) {
                return {};
            }
            postData = yield posts.parsePost(postData);
            postData = yield topics.addPostData([postData], uid);
            return postData[0];
        }
        throw new Error('[[error:invalid-data]]');
    });
};
Flags.targetExists = function (type, id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (type === 'post') {
            return yield posts.exists(id);
        }
        else if (type === 'user') {
            return yield user.exists(id);
        }
        throw new Error('[[error:invalid-data]]');
    });
};
Flags.targetFlagged = function (type, id) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield db.sortedSetScore('flags:byTarget', [type, id].join(':'))) >= 1;
    });
};
Flags.getTargetUid = function (type, id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (type === 'post') {
            return yield posts.getPostField(id, 'uid');
        }
        return id;
    });
};
Flags.getTargetCid = function (type, id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (type === 'post') {
            return yield posts.getCidByPid(id);
        }
        return null;
    });
};
Flags.update = function (flagId, uid, changeset) {
    return __awaiter(this, void 0, void 0, function* () {
        const current = yield db.getObjectFields(`flag:${flagId}`, ['uid', 'state', 'assignee', 'type', 'targetId']);
        if (!current.type) {
            return;
        }
        const now = changeset.datetime || Date.now();
        const notifyAssignee = function (assigneeId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (assigneeId === '' || parseInt(uid, 10) === parseInt(assigneeId, 10)) {
                    return;
                }
                const notifObj = yield notifications.create({
                    type: 'my-flags',
                    bodyShort: `[[notifications:flag_assigned_to_you, ${flagId}]]`,
                    bodyLong: '',
                    path: `/flags/${flagId}`,
                    nid: `flags:assign:${flagId}:uid:${assigneeId}`,
                    from: uid,
                });
                yield notifications.push(notifObj, [assigneeId]);
            });
        };
        const isAssignable = function (assigneeId) {
            return __awaiter(this, void 0, void 0, function* () {
                let allowed = false;
                allowed = yield user.isAdminOrGlobalMod(assigneeId);
                // Mods are also allowed to be assigned, if flag target is post in uid's moderated cid
                if (!allowed && current.type === 'post') {
                    const cid = yield posts.getCidByPid(current.targetId);
                    allowed = yield user.isModerator(assigneeId, cid);
                }
                return allowed;
            });
        };
        // Retrieve existing flag data to compare for history-saving/reference purposes
        const tasks = [];
        for (const prop of Object.keys(changeset)) {
            if (current[prop] === changeset[prop]) {
                delete changeset[prop];
            }
            else if (prop === 'state') {
                if (!Flags._constants.states.includes(changeset[prop])) {
                    delete changeset[prop];
                }
                else {
                    tasks.push(db.sortedSetAdd(`flags:byState:${changeset[prop]}`, now, flagId));
                    tasks.push(db.sortedSetRemove(`flags:byState:${current[prop]}`, flagId));
                    if (changeset[prop] === 'resolved' && meta.config['flags:actionOnResolve'] === 'rescind') {
                        tasks.push(notifications.rescind(`flag:${current.type}:${current.targetId}`));
                    }
                    if (changeset[prop] === 'rejected' && meta.config['flags:actionOnReject'] === 'rescind') {
                        tasks.push(notifications.rescind(`flag:${current.type}:${current.targetId}`));
                    }
                }
            }
            else if (prop === 'assignee') {
                if (changeset[prop] === '') {
                    tasks.push(db.sortedSetRemove(`flags:byAssignee:${changeset[prop]}`, flagId));
                    /* eslint-disable-next-line */
                }
                else if (!(yield isAssignable(parseInt(changeset[prop], 10)))) {
                    delete changeset[prop];
                }
                else {
                    tasks.push(db.sortedSetAdd(`flags:byAssignee:${changeset[prop]}`, now, flagId));
                    tasks.push(notifyAssignee(changeset[prop]));
                }
            }
        }
        if (!Object.keys(changeset).length) {
            return;
        }
        tasks.push(db.setObject(`flag:${flagId}`, changeset));
        tasks.push(Flags.appendHistory(flagId, uid, changeset));
        yield Promise.all(tasks);
        plugins.hooks.fire('action:flags.update', { flagId: flagId, changeset: changeset, uid: uid });
    });
};
Flags.resolveFlag = function (type, id, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const flagId = yield Flags.getFlagIdByTarget(type, id);
        if (parseInt(flagId, 10)) {
            yield Flags.update(flagId, uid, { state: 'resolved' });
        }
    });
};
Flags.resolveUserPostFlags = function (uid, callerUid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta.config['flags:autoResolveOnBan']) {
            yield batch.processSortedSet(`uid:${uid}:posts`, (pids) => __awaiter(this, void 0, void 0, function* () {
                let postData = yield posts.getPostsFields(pids, ['pid', 'flagId']);
                postData = postData.filter(p => p && p.flagId);
                for (const postObj of postData) {
                    if (parseInt(postObj.flagId, 10)) {
                        // eslint-disable-next-line no-await-in-loop
                        yield Flags.update(postObj.flagId, callerUid, { state: 'resolved' });
                    }
                }
            }), {
                batch: 500,
            });
        }
    });
};
Flags.getHistory = function (flagId) {
    return __awaiter(this, void 0, void 0, function* () {
        const uids = [];
        let history = yield db.getSortedSetRevRangeWithScores(`flag:${flagId}:history`, 0, -1);
        const targetUid = yield db.getObjectField(`flag:${flagId}`, 'targetUid');
        history = history.map((entry) => {
            entry.value = JSON.parse(entry.value);
            uids.push(entry.value[0]);
            // Deserialise changeset
            const changeset = entry.value[1];
            if (changeset.hasOwnProperty('state')) {
                changeset.state = changeset.state === undefined ? '' : `[[flags:state-${changeset.state}]]`;
            }
            return {
                uid: entry.value[0],
                fields: changeset,
                datetime: entry.score,
                datetimeISO: utils.toISOString(entry.score),
            };
        });
        // Append ban history and username change data
        history = yield mergeBanHistory(history, targetUid, uids);
        history = yield mergeMuteHistory(history, targetUid, uids);
        history = yield mergeUsernameEmailChanges(history, targetUid, uids);
        const userData = yield user.getUsersFields(uids, ['username', 'userslug', 'picture']);
        history.forEach((event, idx) => { event.user = userData[idx]; });
        // Resort by date
        history = history.sort((a, b) => b.datetime - a.datetime);
        return history;
    });
};
Flags.appendHistory = function (flagId, uid, changeset) {
    return __awaiter(this, void 0, void 0, function* () {
        const datetime = changeset.datetime || Date.now();
        delete changeset.datetime;
        const payload = JSON.stringify([uid, changeset, datetime]);
        yield db.sortedSetAdd(`flag:${flagId}:history`, datetime, payload);
    });
};
Flags.appendNote = function (flagId, uid, note, datetime) {
    return __awaiter(this, void 0, void 0, function* () {
        if (datetime) {
            try {
                yield Flags.deleteNote(flagId, datetime);
            }
            catch (e) {
                // Do not throw if note doesn't exist
                if (!e.message === '[[error:invalid-data]]') {
                    throw e;
                }
            }
        }
        datetime = datetime || Date.now();
        const payload = JSON.stringify([uid, note]);
        yield db.sortedSetAdd(`flag:${flagId}:notes`, datetime, payload);
        yield Flags.appendHistory(flagId, uid, {
            notes: null,
            datetime: datetime,
        });
    });
};
Flags.notify = function (flagObj, uid, notifySelf = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const [admins, globalMods] = yield Promise.all([
            groups.getMembers('administrators', 0, -1),
            groups.getMembers('Global Moderators', 0, -1),
        ]);
        let uids = admins.concat(globalMods);
        let notifObj = null;
        const { displayname } = flagObj.reports[flagObj.reports.length - 1].reporter;
        if (flagObj.type === 'post') {
            const [title, cid] = yield Promise.all([
                topics.getTitleByPid(flagObj.targetId),
                posts.getCidByPid(flagObj.targetId),
            ]);
            const modUids = yield categories.getModeratorUids([cid]);
            const titleEscaped = utils.decodeHTMLEntities(title).replace(/%/g, '&#37;').replace(/,/g, '&#44;');
            notifObj = yield notifications.create({
                type: 'new-post-flag',
                bodyShort: `[[notifications:user_flagged_post_in, ${displayname}, ${titleEscaped}]]`,
                bodyLong: yield plugins.hooks.fire('filter:parse.raw', String(flagObj.description || '')),
                pid: flagObj.targetId,
                path: `/flags/${flagObj.flagId}`,
                nid: `flag:post:${flagObj.targetId}`,
                from: uid,
                mergeId: `notifications:user_flagged_post_in|${flagObj.targetId}`,
                topicTitle: title,
            });
            uids = uids.concat(modUids[0]);
        }
        else if (flagObj.type === 'user') {
            const targetDisplayname = flagObj.target && flagObj.target.user ? flagObj.target.user.displayname : '[[global:guest]]';
            notifObj = yield notifications.create({
                type: 'new-user-flag',
                bodyShort: `[[notifications:user_flagged_user, ${displayname}, ${targetDisplayname}]]`,
                bodyLong: yield plugins.hooks.fire('filter:parse.raw', String(flagObj.description || '')),
                path: `/flags/${flagObj.flagId}`,
                nid: `flag:user:${flagObj.targetId}`,
                from: uid,
                mergeId: `notifications:user_flagged_user|${flagObj.targetId}`,
            });
        }
        else {
            throw new Error('[[error:invalid-data]]');
        }
        plugins.hooks.fire('action:flags.notify', {
            flag: flagObj,
            notification: notifObj,
            from: uid,
            to: uids,
        });
        if (!notifySelf) {
            uids = uids.filter(_uid => parseInt(_uid, 10) !== parseInt(uid, 10));
        }
        yield notifications.push(notifObj, uids);
    });
};
function mergeBanHistory(history, targetUid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield mergeBanMuteHistory(history, uids, {
            set: `uid:${targetUid}:bans:timestamp`,
            label: '[[user:banned]]',
            reasonDefault: '[[user:info.banned-no-reason]]',
            expiryKey: '[[user:info.banned-expiry]]',
        });
    });
}
function mergeMuteHistory(history, targetUid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield mergeBanMuteHistory(history, uids, {
            set: `uid:${targetUid}:mutes:timestamp`,
            label: '[[user:muted]]',
            reasonDefault: '[[user:info.muted-no-reason]]',
            expiryKey: '[[user:info.muted-expiry]]',
        });
    });
}
function mergeBanMuteHistory(history, uids, params) {
    return __awaiter(this, void 0, void 0, function* () {
        let recentObjs = yield db.getSortedSetRevRange(params.set, 0, 19);
        recentObjs = yield db.getObjects(recentObjs);
        return history.concat(recentObjs.reduce((memo, cur) => {
            uids.push(cur.fromUid);
            memo.push({
                uid: cur.fromUid,
                meta: [
                    {
                        key: params.label,
                        value: validator.escape(String(cur.reason || params.reasonDefault)),
                        labelClass: 'danger',
                    },
                    {
                        key: params.expiryKey,
                        value: new Date(parseInt(cur.expire, 10)).toISOString(),
                        labelClass: 'default',
                    },
                ],
                datetime: parseInt(cur.timestamp, 10),
                datetimeISO: utils.toISOString(parseInt(cur.timestamp, 10)),
            });
            return memo;
        }, []));
    });
}
function mergeUsernameEmailChanges(history, targetUid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        const usernameChanges = yield user.getHistory(`user:${targetUid}:usernames`);
        const emailChanges = yield user.getHistory(`user:${targetUid}:emails`);
        return history.concat(usernameChanges.reduce((memo, changeObj) => {
            uids.push(targetUid);
            memo.push({
                uid: targetUid,
                meta: [
                    {
                        key: '[[user:change_username]]',
                        value: changeObj.value,
                        labelClass: 'primary',
                    },
                ],
                datetime: changeObj.timestamp,
                datetimeISO: changeObj.timestampISO,
            });
            return memo;
        }, [])).concat(emailChanges.reduce((memo, changeObj) => {
            uids.push(targetUid);
            memo.push({
                uid: targetUid,
                meta: [
                    {
                        key: '[[user:change_email]]',
                        value: changeObj.value,
                        labelClass: 'primary',
                    },
                ],
                datetime: changeObj.timestamp,
                datetimeISO: changeObj.timestampISO,
            });
            return memo;
        }, []));
    });
}
require('./promisify').promisify(Flags);
