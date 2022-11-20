'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = void 0;
const xml = require('xml');
const nconf_1 = __importDefault(require("nconf"));
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const handle = function (req, res, next) {
    if (plugins.hooks.hasListeners('filter:search.query')) {
        res.type('application/opensearchdescription+xml').send(generateXML());
    }
    else {
        next();
    }
};
exports.handle = handle;
function generateXML() {
    return xml([{
            OpenSearchDescription: [
                {
                    _attr: {
                        xmlns: 'http://a9.com/-/spec/opensearch/1.1/',
                        'xmlns:moz': 'http://www.mozilla.org/2006/browser/search/',
                    },
                },
                { ShortName: trimToLength(String(meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB'), 16) },
                { Description: trimToLength(String(meta_1.default.config.description || ''), 1024) },
                { InputEncoding: 'UTF-8' },
                {
                    Image: [
                        {
                            _attr: {
                                width: '16',
                                height: '16',
                                type: 'image/x-icon',
                            },
                        },
                        `${nconf_1.default.get('url')}/favicon.ico`,
                    ],
                },
                {
                    Url: {
                        _attr: {
                            type: 'text/html',
                            method: 'get',
                            template: `${nconf_1.default.get('url')}/search?term={searchTerms}&in=titlesposts`,
                        },
                    },
                },
                { 'moz:SearchForm': `${nconf_1.default.get('url')}/search` },
            ],
        }], { declaration: true, indent: '\t' });
}
function trimToLength(string, length) {
    return string.trim().substring(0, length).trim();
}
