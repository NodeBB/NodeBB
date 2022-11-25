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
const _ = require('lodash');
const nconf_1 = __importDefault(require("nconf"));
const path_1 = __importDefault(require("path"));
const validator = require('validator');
const database = __importStar(require("../database"));
const db = database;
const file = require('../file');
const plugins = require('../plugins');
const posts = require('../posts');
const meta_1 = __importDefault(require("../meta"));
const cache = require('../cache');
const Thumbs = {};
Thumbs.exists = function (id, path) {
    return __awaiter(this, void 0, void 0, function* () {
        const isDraft = validator.isUUID(String(id));
        const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
        return db.isSortedSetMember(set, path);
    });
};
Thumbs.load = function (topicData) {
    return __awaiter(this, void 0, void 0, function* () {
        const topicsWithThumbs = topicData.filter((t) => t && parseInt(t.numThumbs, 10) > 0);
        const tidsWithThumbs = topicsWithThumbs.map((t) => t.tid);
        const thumbs = yield Thumbs.get(tidsWithThumbs);
        const tidToThumbs = _.zipObject(tidsWithThumbs, thumbs);
        return topicData.map((t) => (t && t.tid ? (tidToThumbs[t.tid] || []) : []));
    });
};
Thumbs.get = function (tids) {
    return __awaiter(this, void 0, void 0, function* () {
        // Allow singular or plural usage
        let singular = false;
        if (!Array.isArray(tids)) {
            tids = [tids];
            singular = true;
        }
        if (!meta_1.default.config.allowTopicsThumbnail || !tids.length) {
            return singular ? [] : tids.map(() => []);
        }
        const hasTimestampPrefix = /^\d+-/;
        const upload_url = nconf_1.default.get('relative_path') + nconf_1.default.get('upload_url');
        const sets = tids.map(tid => `${validator.isUUID(String(tid)) ? 'draft' : 'topic'}:${tid}:thumbs`);
        const thumbs = yield Promise.all(sets.map(getThumbs));
        let response = thumbs.map((thumbSet, idx) => thumbSet.map((thumb) => ({
            id: tids[idx],
            name: (() => {
                const name = path_1.default.basename(thumb);
                return hasTimestampPrefix.test(name) ? name.slice(14) : name;
            })(),
            url: thumb.startsWith('http') ? thumb : path_1.default.posix.join(upload_url, thumb),
        })));
        ({ thumbs: response } = yield plugins.hooks.fire('filter:topics.getThumbs', { tids, thumbs: response }));
        return singular ? response.pop() : response;
    });
};
function getThumbs(set) {
    return __awaiter(this, void 0, void 0, function* () {
        const cached = cache.get(set);
        if (cached !== undefined) {
            return cached.slice();
        }
        const thumbs = yield db.getSortedSetRange(set, 0, -1);
        cache.set(set, thumbs);
        return thumbs.slice();
    });
}
Thumbs.associate = function ({ id, path, score }) {
    return __awaiter(this, void 0, void 0, function* () {
        // Associates a newly uploaded file as a thumb to the passed-in draft or topic
        const isDraft = validator.isUUID(String(id));
        const isLocal = !path.startsWith('http');
        const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
        const numThumbs = yield db.sortedSetCard(set);
        // Normalize the path to allow for changes in upload_path (and so upload_url can be appended if needed)
        if (isLocal) {
            path = path.replace(nconf_1.default.get('upload_path'), '');
        }
        const topics = require('.');
        yield db.sortedSetAdd(set, isFinite(score) ? score : numThumbs, path);
        if (!isDraft) {
            const numThumbs = yield db.sortedSetCard(set);
            yield topics.setTopicField(id, 'numThumbs', numThumbs);
        }
        cache.del(set);
        // Associate thumbnails with the main pid (only on local upload)
        if (!isDraft && isLocal) {
            const mainPid = (yield topics.getMainPids([id]))[0];
            yield posts.uploads.associate(mainPid, path.slice(1));
        }
    });
};
Thumbs.migrate = function (uuid, id) {
    return __awaiter(this, void 0, void 0, function* () {
        // Converts the draft thumb zset to the topic zset (combines thumbs if applicable)
        const set = `draft:${uuid}:thumbs`;
        const thumbs = yield db.getSortedSetRangeWithScores(set, 0, -1);
        yield Promise.all(thumbs.map((thumb) => __awaiter(this, void 0, void 0, function* () {
            return yield Thumbs.associate({
                id,
                path: thumb.value,
                score: thumb.score,
            });
        })));
        yield db.delete(set);
        cache.del(set);
    });
};
Thumbs.delete = function (id, relativePaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const isDraft = validator.isUUID(String(id));
        const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
        if (typeof relativePaths === 'string') {
            relativePaths = [relativePaths];
        }
        else if (!Array.isArray(relativePaths)) {
            throw new Error('[[error:invalid-data]]');
        }
        const absolutePaths = relativePaths.map(relativePath => path_1.default.join(nconf_1.default.get('upload_path'), relativePath));
        const [associated, existsOnDisk] = yield Promise.all([
            db.isSortedSetMembers(set, relativePaths),
            Promise.all(absolutePaths.map((absolutePath) => __awaiter(this, void 0, void 0, function* () { return file.exists(absolutePath); }))),
        ]);
        const toRemove = [];
        const toDelete = [];
        relativePaths.forEach((relativePath, idx) => {
            if (associated[idx]) {
                toRemove.push(relativePath);
            }
            if (existsOnDisk[idx]) {
                toDelete.push(absolutePaths[idx]);
            }
        });
        yield db.sortedSetRemove(set, toRemove);
        if (isDraft && toDelete.length) { // drafts only; post upload dissociation handles disk deletion for topics
            yield Promise.all(toDelete.map((absolutePath) => __awaiter(this, void 0, void 0, function* () { return file.delete(absolutePath); })));
        }
        if (toRemove.length && !isDraft) {
            const topics = require('.');
            const mainPid = (yield topics.getMainPids([id]))[0];
            yield Promise.all([
                db.incrObjectFieldBy(`topic:${id}`, 'numThumbs', -toRemove.length),
                Promise.all(toRemove.map((relativePath) => __awaiter(this, void 0, void 0, function* () { return posts.uploads.dissociate(mainPid, relativePath.slice(1)); }))),
            ]);
        }
    });
};
Thumbs.deleteAll = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isDraft = validator.isUUID(String(id));
    const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
    const thumbs = yield db.getSortedSetRange(set, 0, -1);
    yield Thumbs.delete(id, thumbs);
});
