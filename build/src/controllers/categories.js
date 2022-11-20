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
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const categories = require('../categories');
const meta_1 = __importDefault(require("../meta"));
const pagination = require('../pagination');
const helpers = require('./helpers').defualt;
const privileges = require('../privileges');
const categoriesController = {};
categoriesController.list = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        res.locals.metaTags = [{
                name: 'title',
                content: String(meta_1.default.config.title || 'NodeBB'),
            }, {
                property: 'og:type',
                content: 'website',
            }];
        const allRootCids = yield categories.getAllCidsFromSet('cid:0:children');
        const rootCids = yield privileges.categories.filterCids('find', allRootCids, req.uid);
        const pageCount = Math.max(1, Math.ceil(rootCids.length / meta_1.default.config.categoriesPerPage));
        const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
        const start = Math.max(0, (page - 1) * meta_1.default.config.categoriesPerPage);
        const stop = start + meta_1.default.config.categoriesPerPage - 1;
        const pageCids = rootCids.slice(start, stop + 1);
        const allChildCids = _.flatten(yield Promise.all(pageCids.map(categories.getChildrenCids)));
        const childCids = yield privileges.categories.filterCids('find', allChildCids, req.uid);
        const categoryData = yield categories.getCategories(pageCids.concat(childCids), req.uid);
        const tree = categories.getTree(categoryData, 0);
        yield categories.getRecentTopicReplies(categoryData, req.uid, req.query);
        const data = {
            title: meta_1.default.config.homePageTitle || '[[pages:home]]',
            selectCategoryLabel: '[[pages:categories]]',
            categories: tree,
            pagination: pagination.create(page, pageCount, req.query),
        };
        data.categories.forEach((category) => {
            if (category) {
                helpers.trimChildren(category);
                helpers.setCategoryTeaser(category);
            }
        });
        if (req.originalUrl.startsWith(`${nconf_1.default.get('relative_path')}/api/categories`) || req.originalUrl.startsWith(`${nconf_1.default.get('relative_path')}/categories`)) {
            data.title = '[[pages:categories]]';
            data.breadcrumbs = helpers.buildBreadcrumbs([{ text: data.title }]);
            res.locals.metaTags.push({
                property: 'og:title',
                content: '[[pages:categories]]',
            });
        }
        res.render('categories', data);
    });
};
