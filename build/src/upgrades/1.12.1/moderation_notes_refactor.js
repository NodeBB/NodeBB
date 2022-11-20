/* eslint-disable no-await-in-loop */
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
const batch = require('../../batch');
exports.default = {
    name: 'Update moderation notes to hashes',
    timestamp: Date.UTC(2019, 3, 5),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    progress.incr();
                    const notes = yield database_1.default.getSortedSetRevRange(`uid:${uid}:moderation:notes`, 0, -1);
                    for (const note of notes) {
                        const noteData = JSON.parse(note);
                        noteData.timestamp = noteData.timestamp || Date.now();
                        yield database_1.default.sortedSetRemove(`uid:${uid}:moderation:notes`, note);
                        yield database_1.default.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, {
                            uid: noteData.uid,
                            timestamp: noteData.timestamp,
                            note: noteData.note,
                        });
                        yield database_1.default.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
                    }
                })));
            }), {
                progress: this.progress,
            });
        });
    },
};
