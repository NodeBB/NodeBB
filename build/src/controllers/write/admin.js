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
const meta_1 = __importDefault(require("../../meta"));
const privileges = require('../../privileges');
const analytics = require('../../analytics');
const helpers_1 = __importDefault(require("../helpers"));
const Admin = {};
Admin.updateSetting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ok = yield privileges.admin.can('admin:settings', req.uid);
    if (!ok) {
        return helpers_1.default.formatApiResponse(403, res);
    }
    yield meta_1.default.configs.set(req.params.setting, req.body.value);
    helpers_1.default.formatApiResponse(200, res);
});
Admin.getAnalyticsKeys = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let keys = yield analytics.getKeys();
    // Sort keys alphabetically
    keys = keys.sort((a, b) => (a < b ? -1 : 1));
    helpers_1.default.formatApiResponse(200, res, { keys });
});
Admin.getAnalyticsData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Default returns views from past 24 hours, by hour
    if (!req.query.amount) {
        if (req.query.units === 'days') {
            req.query.amount = 30;
        }
        else {
            req.query.amount = 24;
        }
    }
    const getStats = req.query.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
    helpers_1.default.formatApiResponse(200, res, yield getStats(`analytics:${req.params.set}`, parseInt(req.query.until, 10) || Date.now(), req.query.amount));
});
