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
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Record first entry in username/email history',
    timestamp: Date.UTC(2018, 7, 28),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                function updateHistory(uid, set, fieldName) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const count = yield database_1.default.sortedSetCard(set);
                        if (count <= 0) {
                            // User has not changed their username/email before, record original username
                            const userData = yield user_1.default.getUserFields(uid, [fieldName, 'joindate']);
                            if (userData && userData.joindate && userData[fieldName]) {
                                yield database_1.default.sortedSetAdd(set, userData.joindate, [userData[fieldName], userData.joindate].join(':'));
                            }
                        }
                    });
                }
                yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    yield Promise.all([
                        updateHistory(uid, `user:${uid}:usernames`, 'username'),
                        updateHistory(uid, `user:${uid}:emails`, 'email'),
                    ]);
                    progress.incr();
                })));
            }), {
                progress: this.progress,
            });
        });
    },
};
