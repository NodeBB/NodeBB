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
const database_1 = __importDefault(require("../../database"));
const user_1 = __importDefault(require("../../user"));
const helpers_1 = __importDefault(require("../helpers"));
const accountHelpers = require('./helpers').defualt;
const pagination = require('../../pagination');
const infoController = {};
infoController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        const page = Math.max(1, req.query.page || 1);
        const itemsPerPage = 10;
        const start = (page - 1) * itemsPerPage;
        const stop = start + itemsPerPage - 1;
        const [history, sessions, usernames, emails, notes] = yield Promise.all([
            user_1.default.getModerationHistory(userData.uid),
            user_1.default.auth.getSessions(userData.uid, req.sessionID),
            user_1.default.getHistory(`user:${userData.uid}:usernames`),
            user_1.default.getHistory(`user:${userData.uid}:emails`),
            getNotes(userData, start, stop),
        ]);
        userData.history = history;
        userData.sessions = sessions;
        userData.usernames = usernames;
        userData.emails = emails;
        if (userData.isAdminOrGlobalModeratorOrModerator) {
            userData.moderationNotes = notes.notes;
            const pageCount = Math.ceil(notes.count / itemsPerPage);
            userData.pagination = pagination.create(page, pageCount, req.query);
        }
        userData.title = '[[pages:account/info]]';
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[user:account_info]]' }]);
        res.render('account/info', userData);
    });
};
function getNotes(userData, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!userData.isAdminOrGlobalModeratorOrModerator) {
            return;
        }
        const [notes, count] = yield Promise.all([
            user_1.default.getModerationNotes(userData.uid, start, stop),
            database_1.default.sortedSetCard(`uid:${userData.uid}:moderation:notes`),
        ]);
        return { notes: notes, count: count };
    });
}
