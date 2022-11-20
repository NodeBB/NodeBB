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
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Consolidate multiple flags reports, going forward',
    timestamp: Date.UTC(2020, 6, 16),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            let flags = yield database_1.default.getSortedSetRange('flags:datetime', 0, -1);
            flags = flags.map(flagId => `flag:${flagId}`);
            flags = yield database_1.default.getObjectsFields(flags, ['flagId', 'type', 'targetId', 'uid', 'description', 'datetime']);
            progress.total = flags.length;
            yield batch.processArray(flags, (subset) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(subset.length);
                yield Promise.all(subset.map((flagObj) => __awaiter(this, void 0, void 0, function* () {
                    const methods = [];
                    switch (flagObj.type) {
                        case 'post':
                            methods.push(posts.setPostField.bind(posts, flagObj.targetId, 'flagId', flagObj.flagId));
                            break;
                        case 'user':
                            methods.push(user_1.default.setUserField.bind(user_1.default, flagObj.targetId, 'flagId', flagObj.flagId));
                            break;
                    }
                    methods.push(database_1.default.sortedSetAdd.bind(database_1.default, `flag:${flagObj.flagId}:reports`, flagObj.datetime, String(flagObj.description).slice(0, 250)), database_1.default.sortedSetAdd.bind(database_1.default, `flag:${flagObj.flagId}:reporters`, flagObj.datetime, flagObj.uid));
                    yield Promise.all(methods.map((method) => __awaiter(this, void 0, void 0, function* () { return method(); })));
                })));
            }), {
                progress: progress,
                batch: 500,
            });
        });
    },
};
