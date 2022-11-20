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
const database_1 = __importDefault(require("../../database"));
const groups = require('../../groups');
const categories_1 = __importDefault(require("../../categories"));
const user_1 = __importDefault(require("../../user"));
const meta_1 = __importDefault(require("../../meta"));
const pagination = require('../../pagination');
const categoriesController = require('./categories');
const AdminsMods = {};
AdminsMods.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const rootCid = parseInt(req.query.cid, 10) || 0;
        const cidsCount = yield database_1.default.sortedSetCard(`cid:${rootCid}:children`);
        const pageCount = Math.max(1, Math.ceil(cidsCount / meta_1.default.config.categoriesPerPage));
        const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
        const start = Math.max(0, (page - 1) * meta_1.default.config.categoriesPerPage);
        const stop = start + meta_1.default.config.categoriesPerPage - 1;
        const cids = yield database_1.default.getSortedSetRange(`cid:${rootCid}:children`, start, stop);
        // @ts-ignore
        const selectedCategory = rootCid ? yield categories_1.default.getCategoryData(rootCid) : null;
        // @ts-ignore
        const pageCategories = yield categories_1.default.getCategoriesData(cids);
        const [admins, globalMods, moderators, crumbs] = yield Promise.all([
            groups.get('administrators', { uid: req.uid }),
            groups.get('Global Moderators', { uid: req.uid }),
            getModeratorsOfCategories(pageCategories),
            categoriesController.buildBreadCrumbs(selectedCategory, '/admin/manage/admins-mods'),
        ]);
        res.render('admin/manage/admins-mods', {
            admins: admins,
            globalMods: globalMods,
            categoryMods: moderators,
            selectedCategory: selectedCategory,
            pagination: pagination.create(page, pageCount, req.query),
            breadcrumbs: crumbs,
        });
    });
};
function getModeratorsOfCategories(categoryData) {
    return __awaiter(this, void 0, void 0, function* () {
        const [moderatorUids, childrenCounts] = yield Promise.all([
            // @ts-ignore
            categories_1.default.getModeratorUids(categoryData.map((c) => c.cid)),
            database_1.default.sortedSetsCard(categoryData.map((c) => `cid:${c.cid}:children`)),
        ]);
        const uids = _.uniq(_.flatten(moderatorUids));
        const moderatorData = yield user_1.default.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
        const moderatorMap = _.zipObject(uids, moderatorData);
        categoryData.forEach((c, index) => {
            c.moderators = moderatorUids[index].map((uid) => moderatorMap[uid]);
            c.subCategoryCount = childrenCounts[index];
        });
        return categoryData;
    });
}
