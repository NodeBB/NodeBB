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
const user_1 = __importDefault(require("../../user"));
const categories_1 = __importDefault(require("../../categories"));
const accountHelpers = require('./helpers').defualt;
const helpers_1 = __importDefault(require("../helpers"));
const pagination = require('../../pagination');
const meta_1 = __importDefault(require("../../meta"));
const categoriesController = {};
categoriesController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        const [states, allCategoriesData] = yield Promise.all([
            user_1.default.getCategoryWatchState(userData.uid),
            // @ts-ignore
            categories_1.default.buildForSelect(userData.uid, 'find', ['descriptionParsed', 'depth', 'slug']),
        ]);
        const pageCount = Math.max(1, Math.ceil(allCategoriesData.length / meta_1.default.config.categoriesPerPage));
        const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
        const start = Math.max(0, (page - 1) * meta_1.default.config.categoriesPerPage);
        const stop = start + meta_1.default.config.categoriesPerPage - 1;
        const categoriesData = allCategoriesData.slice(start, stop + 1);
        categoriesData.forEach((category) => {
            if (category) {
                // @ts-ignore
                category.isIgnored = states[category.cid] === categories_1.default.watchStates.ignoring;
                // @ts-ignore
                category.isWatched = states[category.cid] === categories_1.default.watchStates.watching;
                // @ts-ignore
                category.isNotWatched = states[category.cid] === categories_1.default.watchStates.notwatching;
            }
        });
        userData.categories = categoriesData;
        userData.title = `[[pages:account/watched_categories, ${userData.username}]]`;
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([
            { text: userData.username, url: `/user/${userData.userslug}` },
            { text: '[[pages:categories]]' },
        ]);
        userData.pagination = pagination.create(page, pageCount, req.query);
        res.render('account/categories', userData);
    });
};
