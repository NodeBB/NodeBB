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
const batch = require('../../batch');
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Fix sort by votes for moved topics',
    timestamp: Date.UTC(2018, 0, 8),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(tids.map((tid) => __awaiter(this, void 0, void 0, function* () {
                    progress.incr();
                    const topicData = yield db.getObjectFields(`topic:${tid}`, ['cid', 'oldCid', 'upvotes', 'downvotes', 'pinned']);
                    if (topicData.cid && topicData.oldCid) {
                        const upvotes = parseInt(topicData.upvotes, 10) || 0;
                        const downvotes = parseInt(topicData.downvotes, 10) || 0;
                        const votes = upvotes - downvotes;
                        yield db.sortedSetRemove(`cid:${topicData.oldCid}:tids:votes`, tid);
                        if (parseInt(topicData.pinned, 10) !== 1) {
                            yield db.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, votes, tid);
                        }
                    }
                })));
            }), {
                progress: progress,
                batch: 500,
            });
        });
    },
};
