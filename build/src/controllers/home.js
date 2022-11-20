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
exports.pluginHook = exports.rewrite = void 0;
const url = require('url');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
function adminHomePageRoute() {
    return ((meta_1.default.config.homePageRoute === 'custom' ? meta_1.default.config.homePageCustom : meta_1.default.config.homePageRoute) || 'categories').replace(/^\//, '');
}
function getUserHomeRoute(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield user_1.default.getSettings(uid);
        let route = adminHomePageRoute();
        if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
            route = (settings.homePageRoute || route).replace(/^\/+/, '');
        }
        return route;
    });
}
function rewrite(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
            return next();
        }
        let route = adminHomePageRoute();
        if (meta_1.default.config.allowUserHomePage) {
            route = yield getUserHomeRoute(req.uid);
        }
        let parsedUrl;
        try {
            parsedUrl = url.parse(route, true);
        }
        catch (err) {
            return next(err);
        }
        const { pathname } = parsedUrl;
        const hook = `action:homepage.get:${pathname}`;
        if (!plugins.hooks.hasListeners(hook)) {
            req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
        }
        else {
            res.locals.homePageRoute = pathname;
        }
        req.query = Object.assign(parsedUrl.query, req.query);
        next();
    });
}
exports.rewrite = rewrite;
function pluginHook(req, res, next) {
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;
    plugins.hooks.fire(hook, {
        req,
        res,
        next,
    });
}
exports.pluginHook = pluginHook;
