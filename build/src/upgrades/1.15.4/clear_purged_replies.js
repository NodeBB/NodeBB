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
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Clear purged replies and toPid',
    timestamp: Date.UTC(2020, 10, 26),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('posts:pid', (pids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(pids.length);
                let postData = yield database_1.default.getObjects(pids.map(pid => `post:${pid}`));
                postData = postData.filter(p => p && parseInt(p.toPid, 10));
                if (!postData.length) {
                    return;
                }
                const toPids = postData.map(p => p.toPid);
                const exists = yield database_1.default.exists(toPids.map(pid => `post:${pid}`));
                const pidsToDelete = postData.filter((p, index) => !exists[index]).map(p => p.pid);
                yield database_1.default.deleteObjectFields(pidsToDelete.map(pid => `post:${pid}`), ['toPid']);
                const repliesToDelete = _.uniq(toPids.filter((pid, index) => !exists[index]));
                yield database_1.default.deleteAll(repliesToDelete.map(pid => `pid:${pid}:replies`));
            }), {
                progress: progress,
                batchSize: 500,
            });
        });
    },
};
