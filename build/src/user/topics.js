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
const database_1 = __importDefault(require("../database"));
function default_1(User) {
    User.getIgnoredTids = function (uid, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSortedSetRevRange(`uid:${uid}:ignored_tids`, start, stop);
        });
    };
    User.addTopicIdToUser = function (uid, tid, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                database_1.default.sortedSetAdd(`uid:${uid}:topics`, timestamp, tid),
                User.incrementUserFieldBy(uid, 'topiccount', 1),
            ]);
        });
    };
}
exports.default = default_1;
;
