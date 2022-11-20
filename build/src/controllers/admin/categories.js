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
const nconf_1 = __importDefault(require("nconf"));
const categories_1 = __importDefault(require("../../categories"));
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const translator = require('../../translator');
const meta_1 = __importDefault(require("../../meta"));
const helpers_1 = __importDefault(require("../helpers"));
const pagination = require('../../pagination');
const categoriesController = {};
categoriesController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const [categoryData, parent, selectedData] = yield Promise.all([
            // @ts-ignore
            categories_1.default.getCategories([req.params.category_id], req.uid),
            // @ts-ignore
            categories_1.default.getParents([req.params.category_id]),
            helpers_1.default.getSelectedCategory(req.params.category_id),
        ]);
        const category = categoryData[0];
        if (!category) {
            return next();
        }
        category.parent = parent[0];
        const data = yield plugins.hooks.fire('filter:admin.category.get', {
            req: req,
            res: res,
            category: category,
            customClasses: [],
        });
        data.category.name = translator.escape(String(data.category.name));
        data.category.description = translator.escape(String(data.category.description));
        res.render('admin/manage/category', {
            category: data.category,
            selectedCategory: selectedData.selectedCategory,
            customClasses: data.customClasses,
            postQueueEnabled: !!meta_1.default.config.postQueue,
        });
    });
};
categoriesController.getAll = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const rootCid = parseInt(req.query.cid, 10) || 0;
        function getRootAndChildren() {
            return __awaiter(this, void 0, void 0, function* () {
                // @ts-ignore
                const rootChildren = yield categories_1.default.getAllCidsFromSet(`cid:${rootCid}:children`);
                // @ts-ignore
                const childCids = _.flatten(yield Promise.all(rootChildren.map((cid) => categories_1.default.getChildrenCids(cid))));
                return [rootCid].concat(rootChildren.concat(childCids));
            });
        }
        // Categories list will be rendered on client side with recursion, etc.
        // @ts-ignore
        const cids = yield (rootCid ? getRootAndChildren() : categories_1.default.getAllCidsFromSet('categories:cid'));
        let rootParent = 0;
        if (rootCid) {
            // @ts-ignore
            rootParent = (yield categories_1.default.getCategoryField(rootCid, 'parentCid')) || 0;
        }
        const fields = [
            'cid', 'name', 'icon', 'parentCid', 'disabled', 'link', 'order',
            'color', 'bgColor', 'backgroundImage', 'imageClass', 'subCategoriesPerPage',
        ];
        const categoriesData = yield categories_1.default.getCategoriesFields(cids, fields);
        const result = yield plugins.hooks.fire('filter:admin.categories.get', { categories: categoriesData, fields: fields });
        let tree = categories_1.default.getTree(result.categories, rootParent);
        const cidsCount = rootCid && tree[0] ? tree[0].children.length : tree.length;
        const pageCount = Math.max(1, Math.ceil(cidsCount / meta_1.default.config.categoriesPerPage));
        const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
        const start = Math.max(0, (page - 1) * meta_1.default.config.categoriesPerPage);
        const stop = start + meta_1.default.config.categoriesPerPage;
        function trim(c) {
            if (c.children) {
                c.subCategoriesLeft = Math.max(0, c.children.length - c.subCategoriesPerPage);
                c.hasMoreSubCategories = c.children.length > c.subCategoriesPerPage;
                c.showMorePage = Math.ceil(c.subCategoriesPerPage / meta_1.default.config.categoriesPerPage);
                c.children = c.children.slice(0, c.subCategoriesPerPage);
                c.children.forEach((c) => trim(c));
            }
        }
        if (rootCid && tree[0] && Array.isArray(tree[0].children)) {
            tree[0].children = tree[0].children.slice(start, stop);
            tree[0].children.forEach(trim);
        }
        else {
            tree = tree.slice(start, stop);
            tree.forEach(trim);
        }
        let selectedCategory;
        if (rootCid) {
            selectedCategory = yield categories_1.default.getCategoryData(rootCid);
        }
        const crumbs = yield buildBreadcrumbs(selectedCategory, '/admin/manage/categories');
        res.render('admin/manage/categories', {
            categoriesTree: tree,
            selectedCategory: selectedCategory,
            breadcrumbs: crumbs,
            pagination: pagination.create(page, pageCount, req.query),
            categoriesPerPage: meta_1.default.config.categoriesPerPage,
        });
    });
};
function buildBreadcrumbs(categoryData, url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!categoryData) {
            return;
        }
        const breadcrumbs = [
            {
                text: categoryData.name,
                url: `${nconf_1.default.get('relative_path')}${url}?cid=${categoryData.cid}`,
                cid: categoryData.cid,
            },
        ];
        const allCrumbs = yield helpers_1.default.buildCategoryBreadcrumbs(categoryData.parentCid);
        const crumbs = allCrumbs.filter((c) => c.cid);
        crumbs.forEach((c) => {
            c.url = `${url}?cid=${c.cid}`;
        });
        crumbs.unshift({
            text: '[[admin/manage/categories:top-level]]',
            url: url,
        });
        return crumbs.concat(breadcrumbs);
    });
}
categoriesController.buildBreadCrumbs = buildBreadcrumbs;
categoriesController.getAnalytics = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const [name, analyticsData] = yield Promise.all([
            categories_1.default.getCategoryField(req.params.category_id, 'name'),
            analytics.getCategoryAnalytics(req.params.category_id),
        ]);
        res.render('admin/manage/category-analytics', {
            name: name,
            analytics: analyticsData,
        });
    });
};
