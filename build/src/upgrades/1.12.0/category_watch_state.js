/* eslint-disable no-await-in-loop */
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
const database = __importStar(require("../../database"));
const db = database;
const batch = require('../../batch');
const categories_1 = __importDefault(require("../../categories"));
exports.default = {
    name: 'Update category watch data',
    timestamp: Date.UTC(2018, 11, 13),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const cids = yield db.getSortedSetRange('categories:cid', 0, -1);
            const keys = cids.map((cid) => `cid:${cid}:ignorers`);
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                for (const cid of cids) {
                    const isMembers = yield db.isSortedSetMembers(`cid:${cid}:ignorers`, uids);
                    uids = uids.filter((uid, index) => isMembers[index]);
                    if (uids.length) {
                        const states = uids.map(() => categories_1.default.watchStates.ignoring);
                        yield db.sortedSetAdd(`cid:${cid}:uid:watch:state`, states, uids);
                    }
                }
            }), {
                progress: progress,
                batch: 500,
            });
            yield db.deleteAll(keys);
        });
    },
};
