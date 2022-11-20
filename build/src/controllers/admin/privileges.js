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
const privileges = require('../../privileges');
const privilegesController = {};
privilegesController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = req.params.cid ? parseInt(req.params.cid, 10) || 0 : 0;
        const isAdminPriv = req.params.cid === 'admin';
        let privilegesData;
        if (cid > 0) {
            privilegesData = yield privileges.categories.list(cid);
        }
        else if (cid === 0) {
            privilegesData = yield (isAdminPriv ? privileges.admin.list(req.uid) : privileges.global.list());
        }
        const categoriesData = [{
                cid: 0,
                name: '[[admin/manage/privileges:global]]',
                icon: 'fa-list',
            }, {
                cid: 'admin',
                name: '[[admin/manage/privileges:admin]]',
                icon: 'fa-lock',
            }];
        let selectedCategory;
        categoriesData.forEach((category) => {
            if (category) {
                category.selected = category.cid === (!isAdminPriv ? cid : 'admin');
                if (category.selected) {
                    selectedCategory = category;
                }
            }
        });
        if (!selectedCategory) {
            selectedCategory = yield categories_1.default.getCategoryFields(cid, ['cid', 'name', 'icon', 'bgColor', 'color']);
        }
        const group = req.query.group ? req.query.group : '';
        res.render('admin/manage/privileges', {
            privileges: privilegesData,
            categories: categoriesData,
            selectedCategory,
            cid,
            group,
            isAdminPriv,
        });
    });
};
