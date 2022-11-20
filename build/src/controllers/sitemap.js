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
const sitemap = require('../sitemap');
const meta_1 = __importDefault(require("../meta"));
const sitemapController = {};
sitemapController.render = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableSitemap']) {
            return setImmediate(next);
        }
        const tplData = yield sitemap.render();
        const xml = yield req.app.renderAsync('sitemap', tplData);
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    });
};
sitemapController.getPages = function (req, res, next) {
    sendSitemap(sitemap.getPages, res, next);
};
sitemapController.getCategories = function (req, res, next) {
    sendSitemap(sitemap.getCategories, res, next);
};
sitemapController.getTopicPage = function (req, res, next) {
    sendSitemap(() => __awaiter(this, void 0, void 0, function* () { return yield sitemap.getTopicPage(parseInt(req.params[0], 10)); }), res, next);
};
function sendSitemap(method, res, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableSitemap']) {
            return setImmediate(callback);
        }
        const xml = yield method();
        if (!xml) {
            return callback();
        }
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    });
}
