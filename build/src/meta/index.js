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
const winston_1 = __importDefault(require("winston"));
const user_1 = __importDefault(require("../user"));
const os = require('os');
const nconf_1 = __importDefault(require("nconf"));
const pubsub = require('../pubsub').default;
const slugify = require('../slugify');
const Meta = {};
Meta.reloadRequired = false;
Meta.config = require('./configs').default;
Meta.themes = require('./themes').default;
Meta.js = require('./js').default;
Meta.css = require('./css').default;
Meta.settings = require('./settings').defualt;
Meta.logs = require('./logs').default;
Meta.errors = require('./errors').default;
Meta.tags = require('./tags').default;
Meta.dependencies = require('./dependencies').default;
Meta.templates = require('./templates').default;
Meta.blacklist = require('./blacklist').default;
Meta.languages = require('./languages').default;
/* Assorted */
Meta.userOrGroupExists = function (slug) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!slug) {
            throw new Error('[[error:invalid-data]]');
        }
        const groups = require('../groups');
        slug = slugify(slug);
        const [userExists, groupExists] = yield Promise.all([
            user_1.default.existsBySlug(slug),
            groups.existsBySlug(slug),
        ]);
        return userExists || groupExists;
    });
};
if (nconf_1.default.get('isPrimary')) {
    pubsub.on('meta:restart', (data) => {
        if (data.hostname !== os.hostname()) {
            restart();
        }
    });
}
Meta.restart = function () {
    pubsub.publish('meta:restart', { hostname: os.hostname() });
    restart();
};
function restart() {
    if (process.send) {
        process.send({
            action: 'restart',
        });
    }
    else {
        winston_1.default.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
    }
}
Meta.getSessionTTLSeconds = function () {
    const ttlDays = 60 * 60 * 24 * Meta.config.loginDays;
    const ttlSeconds = Meta.config.loginSeconds;
    const ttl = ttlSeconds || ttlDays || 1209600; // Default to 14 days
    return ttl;
};
require('../promisify').promisify(Meta);
exports.default = Meta;
