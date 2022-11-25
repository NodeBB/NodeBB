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
const validator = require('validator');
const user_1 = __importDefault(require("../../user"));
const meta_1 = __importDefault(require("../../meta"));
const database = __importStar(require("../../database"));
const db = database;
const path_1 = __importDefault(require("path"));
const pagination = require('../../pagination');
const events = require('../../events');
const plugins = require('../../plugins');
const privileges = require('../../privileges');
const utils = require('../../utils');
const usersController = {};
const userFields = [
    'uid', 'username', 'userslug', 'email', 'postcount', 'joindate', 'banned',
    'reputation', 'picture', 'flags', 'lastonline', 'email:confirmed',
];
usersController.index = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.query.query) {
            yield usersController.search(req, res);
        }
        else {
            yield getUsers(req, res);
        }
    });
};
function getUsers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const sortDirection = req.query.sortDirection || 'desc';
        const reverse = sortDirection === 'desc';
        const page = parseInt(req.query.page, 10) || 1;
        let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
        if (![50, 100, 250, 500].includes(resultsPerPage)) {
            resultsPerPage = 50;
        }
        let sortBy = validator.escape(req.query.sortBy || '');
        const filterBy = Array.isArray(req.query.filters || []) ? (req.query.filters || []) : [req.query.filters];
        const start = Math.max(0, page - 1) * resultsPerPage;
        const stop = start + resultsPerPage - 1;
        function buildSet() {
            const sortToSet = {
                postcount: 'users:postcount',
                reputation: 'users:reputation',
                joindate: 'users:joindate',
                lastonline: 'users:online',
                flags: 'users:flags',
            };
            const set = [];
            if (sortBy) {
                set.push(sortToSet[sortBy]);
            }
            if (filterBy.includes('unverified')) {
                set.push('group:unverified-users:members');
            }
            if (filterBy.includes('verified')) {
                set.push('group:verified-users:members');
            }
            if (filterBy.includes('banned')) {
                set.push('users:banned');
            }
            if (!set.length) {
                set.push('users:online');
                sortBy = 'lastonline';
            }
            return set.length > 1 ? set : set[0];
        }
        function getCount(set) {
            return __awaiter(this, void 0, void 0, function* () {
                if (Array.isArray(set)) {
                    return yield db.sortedSetIntersectCard(set);
                }
                return yield db.sortedSetCard(set);
            });
        }
        function getUids(set) {
            return __awaiter(this, void 0, void 0, function* () {
                let uids = [];
                if (Array.isArray(set)) {
                    const weights = set.map((s, index) => (index ? 0 : 1));
                    uids = yield db[reverse ? 'getSortedSetRevIntersect' : 'getSortedSetIntersect']({
                        sets: set,
                        start: start,
                        stop: stop,
                        weights: weights,
                    });
                }
                else {
                    uids = yield db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
                }
                return uids;
            });
        }
        const set = buildSet();
        const uids = yield getUids(set);
        const [count, users] = yield Promise.all([
            getCount(set),
            loadUserInfo(req.uid, uids),
        ]);
        yield render(req, res, {
            users: users.filter(user => user && parseInt(user.uid, 10)),
            page: page,
            pageCount: Math.max(1, Math.ceil(count / resultsPerPage)),
            resultsPerPage: resultsPerPage,
            reverse: reverse,
            sortBy: sortBy,
        });
    });
}
usersController.search = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const sortDirection = req.query.sortDirection || 'desc';
        const reverse = sortDirection === 'desc';
        const page = parseInt(req.query.page, 10) || 1;
        let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
        if (![50, 100, 250, 500].includes(resultsPerPage)) {
            resultsPerPage = 50;
        }
        const searchData = yield user_1.default.search({
            uid: req.uid,
            query: req.query.query,
            searchBy: req.query.searchBy,
            sortBy: req.query.sortBy,
            sortDirection: sortDirection,
            filters: req.query.filters,
            page: page,
            resultsPerPage: resultsPerPage,
            findUids: function (query, searchBy, hardCap) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!query || query.length < 2) {
                        return [];
                    }
                    query = String(query).toLowerCase();
                    if (!query.endsWith('*')) {
                        query += '*';
                    }
                    const data = yield db.getSortedSetScan({
                        key: `${searchBy}:sorted`,
                        match: query,
                        limit: hardCap || (resultsPerPage * 10),
                    });
                    return data.map(data => data.split(':').pop());
                });
            },
        });
        const uids = searchData.users.map(user => user && user.uid);
        searchData.users = yield loadUserInfo(req.uid, uids);
        if (req.query.searchBy === 'ip') {
            searchData.users.forEach((user) => {
                user.ip = user.ips.find(ip => ip.includes(String(req.query.query)));
            });
        }
        searchData.query = validator.escape(String(req.query.query || ''));
        searchData.page = page;
        searchData.resultsPerPage = resultsPerPage;
        searchData.sortBy = req.query.sortBy;
        searchData.reverse = reverse;
        yield render(req, res, searchData);
    });
};
function loadUserInfo(callerUid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        function getIPs() {
            return __awaiter(this, void 0, void 0, function* () {
                return yield Promise.all(uids.map(uid => db.getSortedSetRevRange(`uid:${uid}:ip`, 0, -1)));
            });
        }
        const [isAdmin, userData, lastonline, ips] = yield Promise.all([
            user_1.default.isAdministrator(uids),
            user_1.default.getUsersWithFields(uids, userFields, callerUid),
            db.sortedSetScores('users:online', uids),
            getIPs(),
        ]);
        userData.forEach((user, index) => {
            if (user) {
                user.administrator = isAdmin[index];
                user.flags = userData[index].flags || 0;
                const timestamp = lastonline[index] || user.joindate;
                user.lastonline = timestamp;
                user.lastonlineISO = utils.toISOString(timestamp);
                user.ips = ips[index];
                user.ip = ips[index] && ips[index][0] ? ips[index][0] : null;
            }
        });
        return userData;
    });
}
usersController.registrationQueue = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const itemsPerPage = 20;
        const start = (page - 1) * 20;
        const stop = start + itemsPerPage - 1;
        const data = yield utils.promiseParallel({
            registrationQueueCount: db.sortedSetCard('registration:queue'),
            users: user_1.default.getRegistrationQueue(start, stop),
            customHeaders: plugins.hooks.fire('filter:admin.registrationQueue.customHeaders', { headers: [] }),
            invites: getInvites(),
        });
        const pageCount = Math.max(1, Math.ceil(data.registrationQueueCount / itemsPerPage));
        data.pagination = pagination.create(page, pageCount);
        data.customHeaders = data.customHeaders.headers;
        res.render('admin/manage/registration', data);
    });
};
function getInvites() {
    return __awaiter(this, void 0, void 0, function* () {
        const invitations = yield user_1.default.getAllInvites();
        const uids = invitations.map(invite => invite.uid);
        let usernames = yield user_1.default.getUsersFields(uids, ['username']);
        usernames = usernames.map(user => user.username);
        invitations.forEach((invites, index) => {
            invites.username = usernames[index];
        });
        function getUsernamesByEmails(emails) {
            return __awaiter(this, void 0, void 0, function* () {
                const uids = yield db.sortedSetScores('email:uid', emails.map(email => String(email).toLowerCase()));
                const usernames = yield user_1.default.getUsersFields(uids, ['username']);
                return usernames.map(user => user.username);
            });
        }
        usernames = yield Promise.all(invitations.map(invites => getUsernamesByEmails(invites.invitations)));
        invitations.forEach((invites, index) => {
            invites.invitations = invites.invitations.map((email, i) => ({
                email: email,
                username: usernames[index][i] === '[[global:guest]]' ? '' : usernames[index][i],
            }));
        });
        return invitations;
    });
}
function render(req, res, data) {
    return __awaiter(this, void 0, void 0, function* () {
        data.pagination = pagination.create(data.page, data.pageCount, req.query);
        const { registrationType } = meta_1.default.config;
        data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
        data.adminInviteOnly = registrationType === 'admin-invite-only';
        data[`sort_${data.sortBy}`] = true;
        if (req.query.searchBy) {
            data[`searchBy_${validator.escape(String(req.query.searchBy))}`] = true;
        }
        const filterBy = Array.isArray(req.query.filters || []) ? (req.query.filters || []) : [req.query.filters];
        filterBy.forEach((filter) => {
            data[`filterBy_${validator.escape(String(filter))}`] = true;
        });
        data.userCount = parseInt(yield db.getObjectField('global', 'userCount'), 10);
        if (data.adminInviteOnly) {
            data.showInviteButton = yield privileges.users.isAdministrator(req.uid);
        }
        else {
            data.showInviteButton = yield privileges.users.hasInvitePrivilege(req.uid);
        }
        res.render('admin/manage/users', data);
    });
}
usersController.getCSV = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield events.log({
            type: 'getUsersCSV',
            uid: req.uid,
            ip: req.ip,
        });
        const { baseDir } = require('../../constants').paths;
        res.sendFile('users.csv', {
            root: path_1.default.join(baseDir, 'build/export'),
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename=users.csv',
            },
        }, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.locals.isAPI = false;
                    return next();
                }
                return next(err);
            }
        });
    });
};
