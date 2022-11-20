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
const path_1 = __importDefault(require("path"));
const fs = require('fs').promises;
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
const file = require('../../file');
exports.default = {
    name: 'Clean up leftover topic thumb sorted sets and files for since-purged topics',
    timestamp: Date.UTC(2022, 1, 7),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const nextTid = yield database_1.default.getObjectField('global', 'nextTid');
            const tids = [];
            for (let x = 1; x < nextTid; x++) {
                tids.push(x);
            }
            const purgedTids = (yield database_1.default.isSortedSetMembers('topics:tid', tids))
                .map((exists, idx) => (exists ? false : tids[idx]))
                .filter(Boolean);
            const affectedTids = (yield database_1.default.exists(purgedTids.map(tid => `topic:${tid}:thumbs`)))
                .map((exists, idx) => (exists ? purgedTids[idx] : false))
                .filter(Boolean);
            progress.total = affectedTids.length;
            yield batch.processArray(affectedTids, (tids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(tids.map((tid) => __awaiter(this, void 0, void 0, function* () {
                    const relativePaths = yield database_1.default.getSortedSetMembers(`topic:${tid}:thumbs`);
                    const absolutePaths = relativePaths.map(relativePath => path_1.default.join(nconf_1.default.get('upload_path'), relativePath));
                    yield Promise.all(absolutePaths.map((absolutePath) => __awaiter(this, void 0, void 0, function* () {
                        const exists = yield file.exists(absolutePath);
                        if (exists) {
                            yield fs.unlink(absolutePath);
                        }
                    })));
                    yield database_1.default.delete(`topic:${tid}:thumbs`);
                    progress.incr();
                })));
            }), {
                progress,
                batch: 100,
            });
        });
    },
};
