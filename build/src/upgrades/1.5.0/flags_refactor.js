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
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Migrating flags to new schema',
    timestamp: Date.UTC(2016, 11, 7),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = require('../../batch');
            const posts = require('../../posts');
            const flags = require('../../flags');
            const { progress } = this;
            yield batch.processSortedSet('posts:pid', (ids) => __awaiter(this, void 0, void 0, function* () {
                let postData = yield posts.getPostsByPids(ids, 1);
                postData = postData.filter(post => post.hasOwnProperty('flags'));
                yield Promise.all(postData.map((post) => __awaiter(this, void 0, void 0, function* () {
                    progress.incr();
                    const [uids, reasons] = yield Promise.all([
                        db.getSortedSetRangeWithScores(`pid:${post.pid}:flag:uids`, 0, -1),
                        db.getSortedSetRange(`pid:${post.pid}:flag:uid:reason`, 0, -1),
                    ]);
                    // Adding in another check here in case a post was improperly dismissed (flag count > 1 but no flags in db)
                    if (uids.length && reasons.length) {
                        // Just take the first entry
                        const datetime = uids[0].score;
                        const reason = reasons[0].split(':')[1];
                        try {
                            const flagObj = yield flags.create('post', post.pid, uids[0].value, reason, datetime);
                            if (post['flag:state'] || post['flag:assignee']) {
                                yield flags.update(flagObj.flagId, 1, {
                                    state: post['flag:state'],
                                    assignee: post['flag:assignee'],
                                    datetime: datetime,
                                });
                            }
                            if (post.hasOwnProperty('flag:notes') && post['flag:notes'].length) {
                                let history = JSON.parse(post['flag:history']);
                                history = history.filter(event => event.type === 'notes')[0];
                                yield flags.appendNote(flagObj.flagId, history.uid, post['flag:notes'], history.timestamp);
                            }
                        }
                        catch (err) {
                            if (err.message !== '[[error:post-already-flagged]]') {
                                throw err;
                            }
                        }
                    }
                })));
            }), {
                progress: this.progress,
            });
        });
    },
};
