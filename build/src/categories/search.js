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
const _ = require('lodash');
const privileges = require('../privileges');
const plugins = require('../plugins');
const database_1 = __importDefault(require("../database"));
function default_1(Categories) {
    Categories.search = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = data.query || '';
            const page = data.page || 1;
            const uid = data.uid || 0;
            const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;
            const startTime = process.hrtime();
            let cids = yield findCids(query, data.hardCap);
            const result = yield plugins.hooks.fire('filter:categories.search', {
                data: data,
                cids: cids,
                uid: uid,
            });
            cids = yield privileges.categories.filterCids('find', result.cids, uid);
            const searchResult = {
                matchCount: cids.length,
            };
            if (paginate) {
                const resultsPerPage = data.resultsPerPage || 50;
                const start = Math.max(0, page - 1) * resultsPerPage;
                const stop = start + resultsPerPage;
                searchResult.pageCount = Math.ceil(cids.length / resultsPerPage);
                cids = cids.slice(start, stop);
            }
            const childrenCids = yield getChildrenCids(cids, uid);
            const uniqCids = _.uniq(cids.concat(childrenCids));
            const categoryData = yield Categories.getCategories(uniqCids, uid);
            Categories.getTree(categoryData, 0);
            yield Categories.getRecentTopicReplies(categoryData, uid, data.qs);
            categoryData.forEach((category) => {
                if (category && Array.isArray(category.children)) {
                    category.children = category.children.slice(0, category.subCategoriesPerPage);
                    category.children.forEach((child) => {
                        child.children = undefined;
                    });
                }
            });
            categoryData.sort((c1, c2) => {
                if (c1.parentCid !== c2.parentCid) {
                    return c1.parentCid - c2.parentCid;
                }
                return c1.order - c2.order;
            });
            // @ts-ignore
            searchResult.timing = (process.elapsedTimeSince(startTime) / 1000).toFixed(2);
            searchResult.categories = categoryData.filter(c => cids.includes(c.cid));
            return searchResult;
        });
    };
    function findCids(query, hardCap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query || String(query).length < 2) {
                return [];
            }
            const data = yield database_1.default.getSortedSetScan({
                key: 'categories:name',
                match: `*${String(query).toLowerCase()}*`,
                limit: hardCap || 500,
            });
            return data.map(data => parseInt(data.split(':').pop(), 10));
        });
    }
    function getChildrenCids(cids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const childrenCids = yield Promise.all(cids.map((cid) => Categories.getChildrenCids(cid)));
            return yield privileges.categories.filterCids('find', _.flatten(childrenCids), uid);
        });
    }
}
exports.default = default_1;
;
