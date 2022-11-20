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
const meta_1 = __importDefault(require("../meta"));
const utils = require('../utils');
const slugify = require('../slugify');
const translator = require('../translator');
const plugins = require('../plugins');
const cache = require('../cache');
function default_1(Categories) {
    Categories.update = function (modified) {
        return __awaiter(this, void 0, void 0, function* () {
            const cids = Object.keys(modified);
            yield Promise.all(cids.map((cid) => updateCategory(cid, modified[cid])));
            return cids;
        });
    };
    function updateCategory(cid, modifiedFields) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield Categories.exists(cid);
            if (!exists) {
                return;
            }
            if (modifiedFields.hasOwnProperty('name')) {
                const translated = yield translator.translate(modifiedFields.name);
                modifiedFields.slug = `${cid}/${slugify(translated)}`;
            }
            const result = yield plugins.hooks.fire('filter:category.update', { cid: cid, category: modifiedFields });
            const { category } = result;
            const fields = Object.keys(category);
            // move parent to front, so its updated first
            const parentCidIndex = fields.indexOf('parentCid');
            if (parentCidIndex !== -1 && fields.length > 1) {
                fields.splice(0, 0, fields.splice(parentCidIndex, 1)[0]);
            }
            for (const key of fields) {
                // eslint-disable-next-line no-await-in-loop
                yield updateCategoryField(cid, key, category[key]);
            }
            plugins.hooks.fire('action:category.update', { cid: cid, modified: category });
        });
    }
    function updateCategoryField(cid, key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (key === 'parentCid') {
                return yield updateParent(cid, value);
            }
            else if (key === 'tagWhitelist') {
                return yield updateTagWhitelist(cid, value);
            }
            else if (key === 'name') {
                return yield updateName(cid, value);
            }
            else if (key === 'order') {
                return yield updateOrder(cid, value);
            }
            yield database_1.default.setObjectField(`category:${cid}`, key, value);
            if (key === 'description') {
                yield Categories.parseDescription(cid, value);
            }
        });
    }
    function updateParent(cid, newParent) {
        return __awaiter(this, void 0, void 0, function* () {
            newParent = parseInt(newParent, 10) || 0;
            if (parseInt(cid, 10) === newParent) {
                throw new Error('[[error:cant-set-self-as-parent]]');
            }
            const childrenCids = yield Categories.getChildrenCids(cid);
            if (childrenCids.includes(newParent)) {
                throw new Error('[[error:cant-set-child-as-parent]]');
            }
            const categoryData = yield Categories.getCategoryFields(cid, ['parentCid', 'order']);
            const oldParent = categoryData.parentCid;
            if (oldParent === newParent) {
                return;
            }
            yield Promise.all([
                database_1.default.sortedSetRemove(`cid:${oldParent}:children`, cid),
                database_1.default.sortedSetAdd(`cid:${newParent}:children`, categoryData.order, cid),
                database_1.default.setObjectField(`category:${cid}`, 'parentCid', newParent),
            ]);
            cache.del([
                `cid:${oldParent}:children`,
                `cid:${newParent}:children`,
                `cid:${oldParent}:children:all`,
                `cid:${newParent}:children:all`,
            ]);
        });
    }
    function updateTagWhitelist(cid, tags) {
        return __awaiter(this, void 0, void 0, function* () {
            tags = tags.split(',').map(tag => utils.cleanUpTag(tag, meta_1.default.config.maximumTagLength))
                .filter(Boolean);
            yield database_1.default.delete(`cid:${cid}:tag:whitelist`);
            const scores = tags.map((tag, index) => index);
            yield database_1.default.sortedSetAdd(`cid:${cid}:tag:whitelist`, scores, tags);
            cache.del(`cid:${cid}:tag:whitelist`);
        });
    }
    function updateOrder(cid, order) {
        return __awaiter(this, void 0, void 0, function* () {
            const parentCid = yield Categories.getCategoryField(cid, 'parentCid');
            yield database_1.default.sortedSetsAdd('categories:cid', order, cid);
            const childrenCids = yield database_1.default.getSortedSetRange(`cid:${parentCid}:children`, 0, -1);
            const currentIndex = childrenCids.indexOf(String(cid));
            if (currentIndex === -1) {
                throw new Error('[[error:no-category]]');
            }
            // moves cid to index order - 1 in the array
            if (childrenCids.length > 1) {
                childrenCids.splice(Math.max(0, order - 1), 0, childrenCids.splice(currentIndex, 1)[0]);
            }
            // recalculate orders from array indices
            yield database_1.default.sortedSetAdd(`cid:${parentCid}:children`, childrenCids.map((cid, index) => index + 1), childrenCids);
            yield database_1.default.setObjectBulk(childrenCids.map((cid, index) => [`category:${cid}`, { order: index + 1 }]));
            cache.del([
                'categories:cid',
                `cid:${parentCid}:children`,
                `cid:${parentCid}:children:all`,
            ]);
        });
    }
    Categories.parseDescription = function (cid, description) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedDescription = yield plugins.hooks.fire('filter:parse.raw', description);
            yield Categories.setCategoryField(cid, 'descriptionParsed', parsedDescription);
        });
    };
    function updateName(cid, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldName = yield Categories.getCategoryField(cid, 'name');
            yield database_1.default.sortedSetRemove('categories:name', `${oldName.slice(0, 200).toLowerCase()}:${cid}`);
            yield database_1.default.sortedSetAdd('categories:name', 0, `${newName.slice(0, 200).toLowerCase()}:${cid}`);
            yield database_1.default.setObjectField(`category:${cid}`, 'name', newName);
        });
    }
}
exports.default = default_1;
;
