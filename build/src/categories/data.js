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
const validator = require('validator');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const utils = require('../utils');
const intFields = [
    'cid', 'parentCid', 'disabled', 'isSection', 'order',
    'topic_count', 'post_count', 'numRecentReplies',
    'minTags', 'maxTags', 'postQueue', 'subCategoriesPerPage',
];
function default_1(Categories) {
    Categories.getCategoriesFields = function (cids, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(cids) || !cids.length) {
                return [];
            }
            const keys = cids.map((cid) => `category:${cid}`);
            const categories = yield database_1.default.getObjects(keys, fields);
            const result = yield plugins.hooks.fire('filter:category.getFields', {
                cids: cids,
                categories: categories,
                fields: fields,
                keys: keys,
            });
            result.categories.forEach(category => modifyCategory(category, fields));
            return result.categories;
        });
    };
    Categories.getCategoryData = function (cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const categories = yield Categories.getCategoriesFields([cid], []);
            return categories && categories.length ? categories[0] : null;
        });
    };
    Categories.getCategoriesData = function (cids) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Categories.getCategoriesFields(cids, []);
        });
    };
    Categories.getCategoryField = function (cid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const category = yield Categories.getCategoryFields(cid, [field]);
            return category ? category[field] : null;
        });
    };
    Categories.getCategoryFields = function (cid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const categories = yield Categories.getCategoriesFields([cid], fields);
            return categories ? categories[0] : null;
        });
    };
    Categories.getAllCategoryFields = function (fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const cids = yield Categories.getAllCidsFromSet('categories:cid');
            return yield Categories.getCategoriesFields(cids, fields);
        });
    };
    Categories.setCategoryField = function (cid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.setObjectField(`category:${cid}`, field, value);
        });
    };
    Categories.incrementCategoryFieldBy = function (cid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.incrObjectFieldBy(`category:${cid}`, field, value);
        });
    };
}
exports.default = default_1;
;
function defaultIntField(category, fields, fieldName, defaultField) {
    if (!fields.length || fields.includes(fieldName)) {
        const useDefault = !category.hasOwnProperty(fieldName) ||
            category[fieldName] === null ||
            category[fieldName] === '' ||
            !utils.isNumber(category[fieldName]);
        category[fieldName] = useDefault ? meta_1.default.config[defaultField] : category[fieldName];
    }
}
function modifyCategory(category, fields) {
    if (!category) {
        return;
    }
    defaultIntField(category, fields, 'minTags', 'minimumTagsPerTopic');
    defaultIntField(category, fields, 'maxTags', 'maximumTagsPerTopic');
    defaultIntField(category, fields, 'postQueue', 'postQueue');
    database_1.default.parseIntFields(category, intFields, fields);
    const escapeFields = ['name', 'color', 'bgColor', 'backgroundImage', 'imageClass', 'class', 'link'];
    escapeFields.forEach((field) => {
        if (category.hasOwnProperty(field)) {
            category[field] = validator.escape(String(category[field] || ''));
        }
    });
    if (category.hasOwnProperty('icon')) {
        category.icon = category.icon || 'hidden';
    }
    if (category.hasOwnProperty('post_count')) {
        category.totalPostCount = category.post_count;
    }
    if (category.hasOwnProperty('topic_count')) {
        category.totalTopicCount = category.topic_count;
    }
    if (category.description) {
        category.description = validator.escape(String(category.description));
        category.descriptionParsed = category.descriptionParsed || category.description;
    }
}
