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
const nconf_1 = __importDefault(require("nconf"));
nconf_1.default.argv().env({
    separator: '__',
});
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const _ = require('lodash');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
// Alternate configuration file support
const configFile = path_1.default.resolve(__dirname, '../../../', nconf_1.default.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');
prestart.loadConfig(configFile);
prestart.setupWinston();
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
process.on('message', (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg && msg.uid) {
        yield database_1.default.init();
        yield database_1.default.initSessionStore();
        const targetUid = msg.uid;
        const profileFile = `${targetUid}_profile.json`;
        const profilePath = path_1.default.join(__dirname, '../../../build/export', profileFile);
        const user = require('../index');
        const [userData, userSettings, ips, sessions, usernames, emails, bookmarks, watchedTopics, upvoted, downvoted, following,] = yield Promise.all([
            database_1.default.getObject(`user:${targetUid}`),
            database_1.default.getObject(`user:${targetUid}:settings`),
            user.getIPs(targetUid, 9),
            user.auth.getSessions(targetUid),
            user.getHistory(`user:${targetUid}:usernames`),
            user.getHistory(`user:${targetUid}:emails`),
            getSetData(`uid:${targetUid}:bookmarks`, 'post:', targetUid),
            getSetData(`uid:${targetUid}:followed_tids`, 'topic:', targetUid),
            getSetData(`uid:${targetUid}:upvote`, 'post:', targetUid),
            getSetData(`uid:${targetUid}:downvote`, 'post:', targetUid),
            getSetData(`following:${targetUid}`, 'user:', targetUid),
        ]);
        delete userData.password;
        let chatData = [];
        yield batch.processSortedSet(`uid:${targetUid}:chat:rooms`, (roomIds) => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield Promise.all(roomIds.map(roomId => getRoomMessages(targetUid, roomId)));
            chatData = chatData.concat(_.flatten(result));
        }), { batch: 100, interval: 1000 });
        yield fs.promises.writeFile(profilePath, JSON.stringify({
            user: userData,
            settings: userSettings,
            ips: ips,
            sessions: sessions,
            usernames: usernames,
            emails: emails,
            messages: chatData,
            bookmarks: bookmarks,
            watchedTopics: watchedTopics,
            upvoted: upvoted,
            downvoted: downvoted,
            following: following,
        }, null, 4));
        yield database_1.default.close();
        process.exit(0);
    }
}));
function getRoomMessages(uid, roomId) {
    return __awaiter(this, void 0, void 0, function* () {
        const batch = require('../../batch');
        let data = [];
        yield batch.processSortedSet(`uid:${uid}:chat:room:${roomId}:mids`, (mids) => __awaiter(this, void 0, void 0, function* () {
            const messageData = yield database_1.default.getObjects(mids.map(mid => `message:${mid}`));
            data = data.concat(messageData
                .filter((m) => m && m.fromuid === uid && !m.system)
                .map((m) => ({ content: m.content, timestamp: m.timestamp })));
        }), { batch: 500, interval: 1000 });
        return data;
    });
}
function getSetData(set, keyPrefix, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const privileges = require('../../privileges');
        const batch = require('../../batch');
        let data = [];
        yield batch.processSortedSet(set, (ids) => __awaiter(this, void 0, void 0, function* () {
            if (keyPrefix === 'post:') {
                ids = yield privileges.posts.filter('topics:read', ids, uid);
            }
            else if (keyPrefix === 'topic:') {
                ids = yield privileges.topics.filterTids('topics:read', ids, uid);
            }
            let objData = yield database_1.default.getObjects(ids.map(id => keyPrefix + id));
            if (keyPrefix === 'post:') {
                objData = objData.map((o) => _.pick(o, ['pid', 'content', 'timestamp']));
            }
            else if (keyPrefix === 'topic:') {
                objData = objData.map((o) => _.pick(o, ['tid', 'title', 'timestamp']));
            }
            else if (keyPrefix === 'user:') {
                objData = objData.map((o) => _.pick(o, ['uid', 'username']));
            }
            data = data.concat(objData);
        }), { batch: 500, interval: 1000 });
        return data;
    });
}
