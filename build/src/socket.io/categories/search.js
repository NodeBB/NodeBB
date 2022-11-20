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
const meta_1 = __importDefault(require("../../meta"));
const categories_1 = __importDefault(require("../../categories"));
const privileges = require('../../privileges');
const controllersHelpers = require('../../controllers/helpers');
const plugins = require('../../plugins');
function default_1(SocketCategories) {
    // used by categorySearch module
    SocketCategories.categorySearch = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let cids = [];
            let matchedCids = [];
            const privilege = data.privilege || 'topics:read';
            data.states = (data.states || ['watching', 'notwatching', 'ignoring']).map(state => categories_1.default.watchStates[state]);
            if (data.search) {
                ({ cids, matchedCids } = yield findMatchedCids(socket.uid, data));
            }
            else {
                cids = yield loadCids(socket.uid, data.parentCid);
            }
            const visibleCategories = yield controllersHelpers.getVisibleCategories({
                cids, uid: socket.uid, states: data.states, privilege, showLinks: data.showLinks, parentCid: data.parentCid,
            });
            if (Array.isArray(data.selectedCids)) {
                data.selectedCids = data.selectedCids.map((cid) => parseInt(cid, 10));
            }
            let categoriesData = categories_1.default.buildForSelectCategories(visibleCategories, ['disabledClass'], data.parentCid);
            categoriesData = categoriesData.slice(0, 200);
            categoriesData.forEach((category) => {
                category.selected = data.selectedCids ? data.selectedCids.includes(category.cid) : false;
                if (matchedCids.includes(category.cid)) {
                    category.match = true;
                }
            });
            const result = yield plugins.hooks.fire('filter:categories.categorySearch', Object.assign(Object.assign({ categories: categoriesData }, data), { uid: socket.uid }));
            return result.categories;
        });
    };
    function findMatchedCids(uid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield categories_1.default.search({
                uid: uid,
                query: data.search,
                qs: data.query,
                paginate: false,
            });
            let matchedCids = result.categories.map(c => c.cid);
            // no need to filter if all 3 states are used
            const filterByWatchState = !Object.values(categories_1.default.watchStates)
                .every(state => data.states.includes(state));
            if (filterByWatchState) {
                const states = yield categories_1.default.getWatchState(matchedCids, uid);
                matchedCids = matchedCids.filter((cid, index) => data.states.includes(states[index]));
            }
            const rootCids = _.uniq(_.flatten(yield Promise.all(matchedCids.map(categories_1.default.getParentCids))));
            const allChildCids = _.uniq(_.flatten(yield Promise.all(matchedCids.map(categories_1.default.getChildrenCids))));
            return {
                cids: _.uniq(rootCids.concat(allChildCids).concat(matchedCids)),
                matchedCids: matchedCids,
            };
        });
    }
    function loadCids(uid, parentCid) {
        return __awaiter(this, void 0, void 0, function* () {
            let resultCids = [];
            function getCidsRecursive(cids) {
                return __awaiter(this, void 0, void 0, function* () {
                    const categoryData = yield categories_1.default.getCategoriesFields(cids, ['subCategoriesPerPage']);
                    const cidToData = _.zipObject(cids, categoryData);
                    yield Promise.all(cids.map((cid) => __awaiter(this, void 0, void 0, function* () {
                        const allChildCids = yield categories_1.default.getAllCidsFromSet(`cid:${cid}:children`);
                        if (allChildCids.length) {
                            const childCids = yield privileges.categories.filterCids('find', allChildCids, uid);
                            resultCids.push(...childCids.slice(0, cidToData[cid].subCategoriesPerPage));
                            yield getCidsRecursive(childCids);
                        }
                    })));
                });
            }
            const allRootCids = yield categories_1.default.getAllCidsFromSet(`cid:${parentCid}:children`);
            const rootCids = yield privileges.categories.filterCids('find', allRootCids, uid);
            const pageCids = rootCids.slice(0, meta_1.default.config.categoriesPerPage);
            resultCids = pageCids;
            yield getCidsRecursive(pageCids);
            return resultCids;
        });
    }
}
exports.default = default_1;
;
