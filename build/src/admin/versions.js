'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestVersion = exports.isPrerelease = void 0;
const request = require('request');
const meta_1 = __importDefault(require("../meta"));
let versionCache = '';
let versionCacheLastModified = '';
exports.isPrerelease = /^v?\d+\.\d+\.\d+-.+$/;
function getLatestVersion(callback) {
    const headers = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': encodeURIComponent(`NodeBB Admin Control Panel/${meta_1.default.config.title}`),
    };
    if (versionCacheLastModified) {
        headers['If-Modified-Since'] = versionCacheLastModified;
    }
    request('https://api.github.com/repos/NodeBB/NodeBB/releases/latest', {
        json: true,
        headers: headers,
        timeout: 2000,
    }, (err, res, latestRelease) => {
        if (err) {
            return callback(err);
        }
        if (res.statusCode === 304) {
            return callback(null, versionCache);
        }
        if (res.statusCode !== 200) {
            return callback(new Error(res.statusMessage));
        }
        if (!latestRelease || !latestRelease.tag_name) {
            return callback(new Error('[[error:cant-get-latest-release]]'));
        }
        const tagName = latestRelease.tag_name.replace(/^v/, '');
        versionCache = tagName;
        versionCacheLastModified = res.headers['last-modified'];
        callback(null, versionCache);
    });
}
exports.getLatestVersion = getLatestVersion;
__exportStar(require("../promisify"), exports);
