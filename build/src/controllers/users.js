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
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const database_1 = __importDefault(require("../database"));
const pagination = require('../pagination');
const privileges = require('../privileges');
const helpers = require('./helpers').defualt;
const api = require('../api');
const utils = require('../utils');
const usersController = {};
usersController.index = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const section = req.query.section || 'joindate';
        const sectionToController = {
            joindate: usersController.getUsersSortedByJoinDate,
            online: usersController.getOnlineUsers,
            'sort-posts': usersController.getUsersSortedByPosts,
            'sort-reputation': usersController.getUsersSortedByReputation,
            banned: usersController.getBannedUsers,
            flagged: usersController.getFlaggedUsers,
        };
        if (req.query.query) {
            yield usersController.search(req, res, next);
        }
        else if (sectionToController[section]) {
            yield sectionToController[section](req, res, next);
        }
        else {
            yield usersController.getUsersSortedByJoinDate(req, res, next);
        }
    });
};
usersController.search = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const searchData = yield api.users.search(req, req.query);
        const section = req.query.section || 'joindate';
        searchData.pagination = pagination.create(req.query.page, searchData.pageCount, req.query);
        searchData[`section_${section}`] = true;
        searchData.displayUserSearch = true;
        yield render(req, res, searchData);
    });
};
usersController.getOnlineUsers = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const [userData, guests] = yield Promise.all([
            usersController.getUsers('users:online', req.uid, req.query),
            require('../socket.io/admin/rooms').getTotalGuestCount(),
        ]);
        let hiddenCount = 0;
        if (!userData.isAdminOrGlobalMod) {
            userData.users = userData.users.filter((user) => {
                const showUser = user && (user.uid === req.uid || user.userStatus !== 'offline');
                if (!showUser) {
                    hiddenCount += 1;
                }
                return showUser;
            });
        }
        userData.anonymousUserCount = guests + hiddenCount;
        userData.timeagoCutoff = 1;
        yield render(req, res, userData);
    });
};
usersController.getUsersSortedByPosts = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        yield usersController.renderUsersPage('users:postcount', req, res);
    });
};
usersController.getUsersSortedByReputation = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['reputation:disabled']) {
            return next();
        }
        yield usersController.renderUsersPage('users:reputation', req, res);
    });
};
usersController.getUsersSortedByJoinDate = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        yield usersController.renderUsersPage('users:joindate', req, res);
    });
};
usersController.getBannedUsers = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        yield renderIfAdminOrGlobalMod('users:banned', req, res);
    });
};
usersController.getFlaggedUsers = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        yield renderIfAdminOrGlobalMod('users:flags', req, res);
    });
};
function renderIfAdminOrGlobalMod(set, req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(req.uid);
        if (!isAdminOrGlobalMod) {
            return helpers.notAllowed(req, res);
        }
        yield usersController.renderUsersPage(set, req, res);
    });
}
usersController.renderUsersPage = function (set, req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield usersController.getUsers(set, req.uid, req.query);
        yield render(req, res, userData);
    });
};
usersController.getUsers = function (set, uid, query) {
    return __awaiter(this, void 0, void 0, function* () {
        const setToData = {
            'users:postcount': { title: '[[pages:users/sort-posts]]', crumb: '[[users:top_posters]]' },
            'users:reputation': { title: '[[pages:users/sort-reputation]]', crumb: '[[users:most_reputation]]' },
            'users:joindate': { title: '[[pages:users/latest]]', crumb: '[[global:users]]' },
            'users:online': { title: '[[pages:users/online]]', crumb: '[[global:online]]' },
            'users:banned': { title: '[[pages:users/banned]]', crumb: '[[user:banned]]' },
            'users:flags': { title: '[[pages:users/most-flags]]', crumb: '[[users:most_flags]]' },
        };
        if (!setToData[set]) {
            setToData[set] = { title: '', crumb: '' };
        }
        const breadcrumbs = [{ text: setToData[set].crumb }];
        if (set !== 'users:joindate') {
            breadcrumbs.unshift({ text: '[[global:users]]', url: '/users' });
        }
        const page = parseInt(query.page, 10) || 1;
        const resultsPerPage = meta_1.default.config.userSearchResultsPerPage;
        const start = Math.max(0, page - 1) * resultsPerPage;
        const stop = start + resultsPerPage - 1;
        const [isAdmin, isGlobalMod, canSearch, usersData] = yield Promise.all([
            user_1.default.isAdministrator(uid),
            user_1.default.isGlobalModerator(uid),
            privileges.global.can('search:users', uid),
            usersController.getUsersAndCount(set, uid, start, stop),
        ]);
        const pageCount = Math.ceil(usersData.count / resultsPerPage);
        return {
            users: usersData.users,
            pagination: pagination.create(page, pageCount, query),
            userCount: usersData.count,
            title: setToData[set].title || '[[pages:users/latest]]',
            breadcrumbs: helpers.buildBreadcrumbs(breadcrumbs),
            isAdminOrGlobalMod: isAdmin || isGlobalMod,
            isAdmin: isAdmin,
            isGlobalMod: isGlobalMod,
            displayUserSearch: canSearch,
            [`section_${query.section || 'joindate'}`]: true,
        };
    });
};
usersController.getUsersAndCount = function (set, uid, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        function getCount() {
            return __awaiter(this, void 0, void 0, function* () {
                if (set === 'users:online') {
                    return yield database_1.default.sortedSetCount('users:online', Date.now() - 86400000, '+inf');
                }
                else if (set === 'users:banned' || set === 'users:flags') {
                    return yield database_1.default.sortedSetCard(set);
                }
                return yield database_1.default.getObjectField('global', 'userCount');
            });
        }
        function getUsers() {
            return __awaiter(this, void 0, void 0, function* () {
                if (set === 'users:online') {
                    const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
                    const data = yield database_1.default.getSortedSetRevRangeByScoreWithScores(set, start, count, '+inf', Date.now() - 86400000);
                    const uids = data.map((d) => d.value);
                    const scores = data.map((d) => d.score);
                    const [userStatus, userData] = yield Promise.all([
                        database_1.default.getObjectsFields(uids.map((uid) => `user:${uid}`), ['status']),
                        user_1.default.getUsers(uids, uid),
                    ]);
                    userData.forEach((user, i) => {
                        if (user) {
                            user.lastonline = scores[i];
                            user.lastonlineISO = utils.toISOString(user.lastonline);
                            user.userStatus = userStatus[i].status || 'online';
                        }
                    });
                    return userData;
                }
                return yield user_1.default.getUsersFromSet(set, uid, start, stop);
            });
        }
        const [usersData, count] = yield Promise.all([
            getUsers(),
            getCount(),
        ]);
        return {
            users: usersData.filter((user) => user && parseInt(user.uid, 10)),
            count: count,
        };
    });
};
function render(req, res, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const { registrationType } = meta_1.default.config;
        data.maximumInvites = meta_1.default.config.maximumInvites;
        data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
        data.adminInviteOnly = registrationType === 'admin-invite-only';
        data.invites = yield user_1.default.getInvitesNumber(req.uid);
        data.showInviteButton = false;
        if (data.adminInviteOnly) {
            data.showInviteButton = yield privileges.users.isAdministrator(req.uid);
        }
        else if (req.loggedIn) {
            const canInvite = yield privileges.users.hasInvitePrivilege(req.uid);
            data.showInviteButton = canInvite && (!data.maximumInvites || data.invites < data.maximumInvites);
        }
        data['reputation:disabled'] = meta_1.default.config['reputation:disabled'];
        res.append('X-Total-Count', data.userCount);
        res.render('users', data);
    });
}
