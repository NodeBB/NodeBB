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
const categories_1 = __importDefault(require("../../categories"));
const Categories = {};
Categories.getNames = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield categories_1.default.getAllCategoryFields(['cid', 'name']);
    });
};
Categories.copyPrivilegesToChildren = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield categories_1.default.getChildren([data.cid], socket.uid);
        const children = result[0];
        for (const child of children) {
            // eslint-disable-next-line no-await-in-loop
            yield copyPrivilegesToChildrenRecursive(data.cid, child, data.group, data.filter);
        }
    });
};
function copyPrivilegesToChildrenRecursive(parentCid, category, group, filter) {
    return __awaiter(this, void 0, void 0, function* () {
        yield categories_1.default.copyPrivilegesFrom(parentCid, category.cid, group, filter);
        for (const child of category.children) {
            // eslint-disable-next-line no-await-in-loop
            yield copyPrivilegesToChildrenRecursive(parentCid, child, group, filter);
        }
    });
}
Categories.copySettingsFrom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield categories_1.default.copySettingsFrom(data.fromCid, data.toCid, data.copyParent);
    });
};
Categories.copyPrivilegesFrom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield categories_1.default.copyPrivilegesFrom(data.fromCid, data.toCid, data.group, data.filter);
    });
};
Categories.copyPrivilegesToAllCategories = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        let cids = yield categories_1.default.getAllCidsFromSet('categories:cid');
        cids = cids.filter((cid) => parseInt(cid, 10) !== parseInt(data.cid, 10));
        for (const toCid of cids) {
            // eslint-disable-next-line no-await-in-loop
            yield categories_1.default.copyPrivilegesFrom(data.cid, toCid, data.group, data.filter);
        }
    });
};
