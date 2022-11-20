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
const validator = require('validator');
const helpers = require('./helpers').defualt;
const recentController = require('./recent');
const topController = {};
topController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield recentController.getData(req, 'top', 'votes');
        if (!data) {
            return next();
        }
        const term = helpers.terms[req.query.term] || 'alltime';
        if (req.originalUrl.startsWith(`${nconf_1.default.get('relative_path')}/api/top`) || req.originalUrl.startsWith(`${nconf_1.default.get('relative_path')}/top`)) {
            data.title = `[[pages:top-${term}]]`;
        }
        const feedQs = data.rssFeedUrl.split('?')[1];
        data.rssFeedUrl = `${nconf_1.default.get('relative_path')}/top/${validator.escape(String(req.query.term || 'alltime'))}.rss`;
        if (req.loggedIn) {
            data.rssFeedUrl += `?${feedQs}`;
        }
        res.render('top', data);
    });
};
