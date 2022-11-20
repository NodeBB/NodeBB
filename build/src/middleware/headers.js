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
const os = require('os');
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const meta_1 = __importDefault(require("../meta"));
const languages = require('../languages');
const helpers = require('./helpers').defualt;
const plugins = require('../plugins');
function default_1(middleware) {
    middleware.addHeaders = helpers.try((req, res, next) => {
        const headers = {
            'X-Powered-By': encodeURI(meta_1.default.config['powered-by'] || 'NodeBB'),
            'Access-Control-Allow-Methods': encodeURI(meta_1.default.config['access-control-allow-methods'] || ''),
            'Access-Control-Allow-Headers': encodeURI(meta_1.default.config['access-control-allow-headers'] || ''),
        };
        if (meta_1.default.config['csp-frame-ancestors']) {
            headers['Content-Security-Policy'] = `frame-ancestors ${meta_1.default.config['csp-frame-ancestors']}`;
            if (meta_1.default.config['csp-frame-ancestors'] === '\'none\'') {
                headers['X-Frame-Options'] = 'DENY';
            }
        }
        else {
            headers['Content-Security-Policy'] = 'frame-ancestors \'self\'';
            headers['X-Frame-Options'] = 'SAMEORIGIN';
        }
        if (meta_1.default.config['access-control-allow-origin']) {
            let origins = meta_1.default.config['access-control-allow-origin'].split(',');
            origins = origins.map(origin => origin && origin.trim());
            if (origins.includes(req.get('origin'))) {
                headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
                headers.Vary = headers.Vary ? `${headers.Vary}, Origin` : 'Origin';
            }
        }
        if (meta_1.default.config['access-control-allow-origin-regex']) {
            let originsRegex = meta_1.default.config['access-control-allow-origin-regex'].split(',');
            originsRegex = originsRegex.map((origin) => {
                try {
                    origin = new RegExp(origin.trim());
                }
                catch (err) {
                    winston_1.default.error(`[middleware.addHeaders] Invalid RegExp For access-control-allow-origin ${origin}`);
                    origin = null;
                }
                return origin;
            });
            originsRegex.forEach((regex) => {
                if (regex && regex.test(req.get('origin'))) {
                    headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
                    headers.Vary = headers.Vary ? `${headers.Vary}, Origin` : 'Origin';
                }
            });
        }
        if (meta_1.default.config['access-control-allow-credentials']) {
            headers['Access-Control-Allow-Credentials'] = meta_1.default.config['access-control-allow-credentials'];
        }
        if (process.env.NODE_ENV === 'development') {
            headers['X-Upstream-Hostname'] = os.hostname();
        }
        for (const [key, value] of Object.entries(headers)) {
            if (value) {
                res.setHeader(key, value);
            }
        }
        next();
    });
    middleware.autoLocale = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        yield plugins.hooks.fire('filter:middleware.autoLocale', {
            req: req,
            res: res,
        });
        if (req.query.lang) {
            const langs = yield listCodes();
            if (!langs.includes(req.query.lang)) {
                req.query.lang = meta_1.default.config.defaultLang;
            }
            return next();
        }
        if (meta_1.default.config.autoDetectLang && req.uid === 0) {
            const langs = yield listCodes();
            const lang = req.acceptsLanguages(langs);
            if (!lang) {
                return next();
            }
            req.query.lang = lang;
        }
        next();
    }));
    function listCodes() {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultLang = meta_1.default.config.defaultLang || 'en-GB';
            try {
                const codes = yield languages.listCodes();
                return _.uniq([defaultLang, ...codes]);
            }
            catch (err) {
                winston_1.default.error(`[middleware/autoLocale] Could not retrieve languages codes list! ${err.stack}`);
                return [defaultLang];
            }
        });
    }
}
exports.default = default_1;
;
