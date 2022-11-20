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
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const analytics = require('../analytics');
const usersController = require('./admin/users');
const helpers = require('./helpers').defualt;
const globalModsController = {};
globalModsController.ipBlacklist = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(req.uid);
        if (!isAdminOrGlobalMod) {
            return next();
        }
        const [rules, analyticsData] = yield Promise.all([
            meta_1.default.blacklist.get(),
            analytics.getBlacklistAnalytics(),
        ]);
        res.render('ip-blacklist', {
            title: '[[pages:ip-blacklist]]',
            rules: rules,
            analytics: analyticsData,
            breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:ip-blacklist]]' }]),
        });
    });
};
globalModsController.registrationQueue = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(req.uid);
        if (!isAdminOrGlobalMod) {
            return next();
        }
        yield usersController.registrationQueue(req, res);
    });
};
