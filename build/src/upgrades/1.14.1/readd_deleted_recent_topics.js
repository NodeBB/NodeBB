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
const batch = require('../../batch');
exports.default = {
    name: 'Re-add deleted topics to topics:recent',
    timestamp: Date.UTC(2018, 9, 11),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(tids.length);
                const topicData = yield db.getObjectsFields(tids.map(tid => `topic:${tid}`), ['tid', 'lastposttime', 'viewcount', 'postcount', 'upvotes', 'downvotes']);
                if (!topicData.tid) {
                    return;
                }
                topicData.forEach((t) => {
                    if (t.hasOwnProperty('upvotes') && t.hasOwnProperty('downvotes')) {
                        t.votes = parseInt(t.upvotes, 10) - parseInt(t.downvotes, 10);
                    }
                });
                yield db.sortedSetAdd('topics:recent', topicData.map((t) => t.lastposttime || 0), topicData.map((t) => t.tid));
                yield db.sortedSetAdd('topics:views', topicData.map((t) => t.viewcount || 0), topicData.map((t) => t.tid));
                yield db.sortedSetAdd('topics:posts', topicData.map((t) => t.postcount || 0), topicData.map((t) => t.tid));
                yield db.sortedSetAdd('topics:votes', topicData.map((t) => t.votes || 0), topicData.map((t) => t.tid));
            }), {
                progress: progress,
                batchSize: 500,
            });
        });
    },
};
