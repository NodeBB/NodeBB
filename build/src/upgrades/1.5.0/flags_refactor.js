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
                        database_1.default.getSortedSetRangeWithScores(`pid:${post.pid}:flag:uids`, 0, -1),
                        database_1.default.getSortedSetRange(`pid:${post.pid}:flag:uid:reason`, 0, -1),
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
