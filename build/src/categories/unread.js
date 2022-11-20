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
function default_1(Categories) {
    Categories.markAsRead = function (cids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(cids) || !cids.length || parseInt(uid, 10) <= 0) {
                return;
            }
            let keys = cids.map((cid) => `cid:${cid}:read_by_uid`);
            const hasRead = yield database_1.default.isMemberOfSets(keys, uid);
            keys = keys.filter((key, index) => !hasRead[index]);
            yield database_1.default.setsAdd(keys, uid);
        });
    };
    Categories.markAsUnreadForAll = function (cid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!parseInt(cid, 10)) {
                return;
            }
            yield database_1.default.delete(`cid:${cid}:read_by_uid`);
        });
    };
    Categories.hasReadCategories = function (cids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return cids.map(() => false);
            }
            const sets = cids.map((cid) => `cid:${cid}:read_by_uid`);
            return yield database_1.default.isMemberOfSets(sets, uid);
        });
    };
    Categories.hasReadCategory = function (cid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return false;
            }
            return yield database_1.default.isSetMember(`cid:${cid}:read_by_uid`, uid);
        });
    };
}
exports.default = default_1;
;
