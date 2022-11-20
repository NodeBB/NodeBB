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
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const translator = require('../translator');
const widgets = require('../widgets');
const utils = require('../utils');
const helpers = require('./helpers').defualt;
const relative_path = nconf_1.default.get('relative_path');
function default_1(middleware) {
    middleware.processRender = function processRender(req, res, next) {
        // res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
        const { render } = res;
        res.render = function renderOverride(template, options, fn) {
            return __awaiter(this, void 0, void 0, function* () {
                const self = this;
                const { req } = this;
                function renderMethod(template, options, fn) {
                    return __awaiter(this, void 0, void 0, function* () {
                        options = options || {};
                        if (typeof options === 'function') {
                            fn = options;
                            options = {};
                        }
                        options.loggedIn = req.uid > 0;
                        options.relative_path = relative_path;
                        options.template = { name: template, [template]: true };
                        options.url = (req.baseUrl + req.path.replace(/^\/api/, ''));
                        options.bodyClass = helpers.buildBodyClass(req, res, options);
                        if (req.loggedIn) {
                            res.set('cache-control', 'private');
                        }
                        const buildResult = yield plugins.hooks.fire(`filter:${template}.build`, { req: req, res: res, templateData: options });
                        if (res.headersSent) {
                            return;
                        }
                        const templateToRender = buildResult.templateData.templateToRender || template;
                        const renderResult = yield plugins.hooks.fire('filter:middleware.render', { req: req, res: res, templateData: buildResult.templateData });
                        if (res.headersSent) {
                            return;
                        }
                        options = renderResult.templateData;
                        options._header = {
                            tags: yield meta_1.default.tags.parse(req, renderResult, res.locals.metaTags, res.locals.linkTags),
                        };
                        options.widgets = yield widgets.render(req.uid, {
                            template: `${template}.tpl`,
                            url: options.url,
                            templateData: options,
                            req: req,
                            res: res,
                        });
                        res.locals.template = template;
                        options._locals = undefined;
                        if (res.locals.isAPI) {
                            if (req.route && req.route.path === '/api/') {
                                options.title = '[[pages:home]]';
                            }
                            req.app.set('json spaces', global.env === 'development' || req.query.pretty ? 4 : 0);
                            return res.json(options);
                        }
                        const optionsString = JSON.stringify(options).replace(/<\//g, '<\\/');
                        const results = yield utils.promiseParallel({
                            header: renderHeaderFooter('renderHeader', req, res, options),
                            content: renderContent(render, templateToRender, req, res, options),
                            footer: renderHeaderFooter('renderFooter', req, res, options),
                        });
                        const str = `${results.header +
                            (res.locals.postHeader || '') +
                            results.content}<script id="ajaxify-data" type="application/json">${optionsString}</script>${res.locals.preFooter || ''}${results.footer}`;
                        if (typeof fn !== 'function') {
                            self.send(str);
                        }
                        else {
                            fn(null, str);
                        }
                    });
                }
                try {
                    yield renderMethod(template, options, fn);
                }
                catch (err) {
                    next(err);
                }
            });
        };
        next();
    };
    function renderContent(render, tpl, req, res, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                render.call(res, tpl, options, (err, str) => __awaiter(this, void 0, void 0, function* () {
                    if (err)
                        reject(err);
                    else
                        resolve(yield translate(str, getLang(req, res)));
                }));
            });
        });
    }
    function renderHeaderFooter(method, req, res, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let str = '';
            if (res.locals.renderHeader) {
                str = yield middleware[method](req, res, options);
            }
            else if (res.locals.renderAdminHeader) {
                str = yield middleware.admin[method](req, res, options);
            }
            else {
                str = '';
            }
            return yield translate(str, getLang(req, res));
        });
    }
    function getLang(req, res) {
        let language = (res.locals.config && res.locals.config.userLang) || 'en-GB';
        if (res.locals.renderAdminHeader) {
            language = (res.locals.config && res.locals.config.acpLang) || 'en-GB';
        }
        return req.query.lang ? validator.escape(String(req.query.lang)) : language;
    }
    function translate(str, language) {
        return __awaiter(this, void 0, void 0, function* () {
            const translated = yield translator.translate(str, language);
            return translator.unescape(translated);
        });
    }
}
exports.default = default_1;
;
