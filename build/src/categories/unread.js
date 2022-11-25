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
const database = __importStar(require("../database"));
const db = database;
function default_1(Categories) {
    Categories.markAsRead = function (cids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(cids) || !cids.length || parseInt(uid, 10) <= 0) {
                return;
            }
            let keys = cids.map((cid) => `cid:${cid}:read_by_uid`);
            const hasRead = yield db.isMemberOfSets(keys, uid);
            keys = keys.filter((key, index) => !hasRead[index]);
            yield db.setsAdd(keys, uid);
        });
    };
    Categories.markAsUnreadForAll = function (cid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!parseInt(cid, 10)) {
                return;
            }
            yield db.delete(`cid:${cid}:read_by_uid`);
        });
    };
    Categories.hasReadCategories = function (cids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return cids.map(() => false);
            }
            const sets = cids.map((cid) => `cid:${cid}:read_by_uid`);
            return yield db.isMemberOfSets(sets, uid);
        });
    };
    Categories.hasReadCategory = function (cid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return false;
            }
            return yield db.isSetMember(`cid:${cid}:read_by_uid`, uid);
        });
    };
}
exports.default = default_1;
;
