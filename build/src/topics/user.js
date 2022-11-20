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
function default_1(Topics) {
    Topics.isOwner = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            uid = parseInt(uid, 10);
            if (uid <= 0) {
                return false;
            }
            const author = yield Topics.getTopicField(tid, 'uid');
            return author === uid;
        });
    };
    Topics.getUids = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSortedSetRevRangeByScore(`tid:${tid}:posters`, 0, -1, '+inf', 1);
        });
    };
}
exports.default = default_1;
;
