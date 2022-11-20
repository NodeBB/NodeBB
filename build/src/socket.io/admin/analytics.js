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
const analytics = require('../../analytics');
const utils_1 = __importDefault(require("../../utils"));
const Analytics = {};
Analytics.get = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.graph || !data.units) {
            throw new Error('[[error:invalid-data]]');
        }
        // Default returns views from past 24 hours, by hour
        if (!data.amount) {
            if (data.units === 'days') {
                data.amount = 30;
            }
            else {
                data.amount = 24;
            }
        }
        const getStats = data.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
        if (data.graph === 'traffic') {
            const result = yield utils_1.default.promiseParallel({
                uniqueVisitors: getStats('analytics:uniquevisitors', data.until || Date.now(), data.amount),
                pageviews: getStats('analytics:pageviews', data.until || Date.now(), data.amount),
                pageviewsRegistered: getStats('analytics:pageviews:registered', data.until || Date.now(), data.amount),
                pageviewsGuest: getStats('analytics:pageviews:guest', data.until || Date.now(), data.amount),
                pageviewsBot: getStats('analytics:pageviews:bot', data.until || Date.now(), data.amount),
                summary: analytics.getSummary(),
            });
            result.pastDay = result.pageviews.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10));
            const last = result.pageviews.length - 1;
            result.pageviews[last] = parseInt(result.pageviews[last], 10) + analytics.getUnwrittenPageviews();
            return result;
        }
    });
};
