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
const posts = require('../../posts');
exports.default = {
    name: 'Add target uid to flag objects',
    timestamp: Date.UTC(2020, 7, 22),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('flags:datetime', (flagIds) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(flagIds.length);
                const flagData = yield database_1.default.getObjects(flagIds.map(id => `flag:${id}`));
                for (const flagObj of flagData) {
                    /* eslint-disable no-await-in-loop */
                    if (flagObj) {
                        const { targetId } = flagObj;
                        if (targetId) {
                            if (flagObj.type === 'post') {
                                const targetUid = yield posts.getPostField(targetId, 'uid');
                                if (targetUid) {
                                    yield database_1.default.setObjectField(`flag:${flagObj.flagId}`, 'targetUid', targetUid);
                                }
                            }
                            else if (flagObj.type === 'user') {
                                yield database_1.default.setObjectField(`flag:${flagObj.flagId}`, 'targetUid', targetId);
                            }
                        }
                    }
                }
            }), {
                progress: progress,
                batch: 500,
            });
        });
    },
};
