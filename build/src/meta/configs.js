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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const database_1 = require("../database");
console.log('PRIMARY DB', database_1.primaryDB);
const pubsub = require('../pubsub').default;
const plugins = require('../plugins');
const utils = require('../utils');
const Meta = __importStar(require("./"));
const cacheBuster = require('./cacheBuster');
const defaults = require('../../../install/data/defaults.json');
const Configs = {};
// @ts-ignore
Meta.config = {};
// called after data is loaded from db
function deserialize(config) {
    const deserialized = {};
    Object.keys(config).forEach((key) => {
        const defaultType = typeof defaults[key];
        const type = typeof config[key];
        const number = parseFloat(config[key]);
        if (defaultType === 'string' && type === 'number') {
            deserialized[key] = String(config[key]);
        }
        else if (defaultType === 'number' && type === 'string') {
            if (!isNaN(number) && isFinite(config[key])) {
                deserialized[key] = number;
            }
            else {
                deserialized[key] = defaults[key];
            }
        }
        else if (config[key] === 'true') {
            deserialized[key] = true;
        }
        else if (config[key] === 'false') {
            deserialized[key] = false;
        }
        else if (config[key] === null) {
            deserialized[key] = defaults[key];
        }
        else if (defaultType === 'undefined' && !isNaN(number) && isFinite(config[key])) {
            deserialized[key] = number;
        }
        else if (Array.isArray(defaults[key]) && !Array.isArray(config[key])) {
            try {
                deserialized[key] = JSON.parse(config[key] || '[]');
            }
            catch (err) {
                winston_1.default.error(err.stack);
                deserialized[key] = defaults[key];
            }
        }
        else {
            deserialized[key] = config[key];
        }
    });
    return deserialized;
}
// called before data is saved to db
function serialize(config) {
    const serialized = {};
    Object.keys(config).forEach((key) => {
        const defaultType = typeof defaults[key];
        const type = typeof config[key];
        const number = parseFloat(config[key]);
        if (defaultType === 'string' && type === 'number') {
            serialized[key] = String(config[key]);
        }
        else if (defaultType === 'number' && type === 'string') {
            if (!isNaN(number) && isFinite(config[key])) {
                serialized[key] = number;
            }
            else {
                serialized[key] = defaults[key];
            }
        }
        else if (config[key] === null) {
            serialized[key] = defaults[key];
        }
        else if (defaultType === 'undefined' && !isNaN(number) && isFinite(config[key])) {
            serialized[key] = number;
        }
        else if (Array.isArray(defaults[key]) && Array.isArray(config[key])) {
            serialized[key] = JSON.stringify(config[key]);
        }
        else {
            serialized[key] = config[key];
        }
    });
    return serialized;
}
Configs.deserialize = deserialize;
Configs.serialize = serialize;
Configs.init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const config = yield Configs.list();
        const buster = yield cacheBuster.read();
        config['cache-buster'] = `v=${buster || Date.now()}`;
        // @ts-ignore
        Meta.config = config;
    });
};
Configs.list = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield Configs.getFields([]);
    });
};
Configs.get = function (field) {
    return __awaiter(this, void 0, void 0, function* () {
        const values = yield Configs.getFields([field]);
        return (values.hasOwnProperty(field) && values[field] !== undefined) ? values[field] : null;
    });
};
Configs.getFields = function (fields) {
    return __awaiter(this, void 0, void 0, function* () {
        let values;
        if (fields.length) {
            values = yield database_1.primaryDB.default.getObjectFields('config', fields);
        }
        else {
            values = yield database_1.primaryDB.default.getObject('config');
        }
        values = Object.assign(Object.assign({}, defaults), (values ? deserialize(values) : {}));
        if (!fields.length) {
            values.version = nconf_1.default.get('version');
            values.registry = nconf_1.default.get('registry');
        }
        return values;
    });
};
Configs.set = function (field, value) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!field) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Configs.setMultiple({
            [field]: value,
        });
    });
};
Configs.setMultiple = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield processConfig(data);
        data = serialize(data);
        yield database_1.primaryDB.default.setObject('config', data);
        updateConfig(deserialize(data));
    });
};
Configs.setOnEmpty = function (values) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield database_1.primaryDB.default.getObject('config');
        values = serialize(values);
        const config = Object.assign(Object.assign({}, values), (data ? serialize(data) : {}));
        yield database_1.primaryDB.default.setObject('config', config);
    });
};
Configs.remove = function (field) {
    return __awaiter(this, void 0, void 0, function* () {
        yield database_1.primaryDB.default.deleteObjectField('config', field);
    });
};
Configs.registerHooks = () => {
    plugins.hooks.register('core', {
        hook: 'filter:settings.set',
        method: ({ plugin, settings, quiet }) => __awaiter(void 0, void 0, void 0, function* () {
            if (plugin === 'core.api' && Array.isArray(settings.tokens)) {
                // Generate tokens if not present already
                settings.tokens.forEach((set) => {
                    if (set.token === '') {
                        set.token = utils.generateUUID();
                    }
                    if (isNaN(parseInt(set.uid, 10))) {
                        set.uid = 0;
                    }
                });
            }
            return { plugin, settings, quiet };
        }),
    });
    plugins.hooks.register('core', {
        hook: 'filter:settings.get',
        method: ({ plugin, values }) => __awaiter(void 0, void 0, void 0, function* () {
            if (plugin === 'core.api' && Array.isArray(values.tokens)) {
                values.tokens = values.tokens.map((tokenObj) => {
                    tokenObj.uid = parseInt(tokenObj.uid, 10);
                    if (tokenObj.timestamp) {
                        tokenObj.timestampISO = new Date(parseInt(tokenObj.timestamp, 10)).toISOString();
                    }
                    return tokenObj;
                });
            }
            return { plugin, values };
        }),
    });
};
Configs.cookie = {
    get: () => {
        const cookie = {};
        // @ts-ignore
        if (nconf_1.default.get('cookieDomain') || Meta.config.cookieDomain) {
            // @ts-ignore
            cookie.domain = nconf_1.default.get('cookieDomain') || Meta.config.cookieDomain;
        }
        if (nconf_1.default.get('secure')) {
            cookie.secure = true;
        }
        const relativePath = nconf_1.default.get('relative_path');
        if (relativePath !== '') {
            cookie.path = relativePath;
        }
        // Ideally configurable from ACP, but cannot be "Strict" as then top-level access will treat it as guest.
        cookie.sameSite = 'Lax';
        return cookie;
    },
};
function processConfig(data) {
    return __awaiter(this, void 0, void 0, function* () {
        ensureInteger(data, 'maximumUsernameLength', 1);
        ensureInteger(data, 'minimumUsernameLength', 1);
        ensureInteger(data, 'minimumPasswordLength', 1);
        ensureInteger(data, 'maximumAboutMeLength', 0);
        if (data.minimumUsernameLength > data.maximumUsernameLength) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Promise.all([
            saveRenderedCss(data),
            getLogoSize(data),
        ]);
    });
}
function ensureInteger(data, field, min) {
    if (data.hasOwnProperty(field)) {
        data[field] = parseInt(data[field], 10);
        if (!(data[field] >= min)) {
            throw new Error('[[error:invalid-data]]');
        }
    }
}
function saveRenderedCss(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.customCSS) {
            return;
        }
        const sass = require('../utils').getSass();
        const scssOutput = yield sass.compileStringAsync(data.customCSS, {});
        data.renderedCustomCSS = scssOutput.css.toString();
    });
}
function getLogoSize(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const image = require('../image');
        if (!data['brand:logo']) {
            return;
        }
        let size;
        try {
            size = yield image.size(path_1.default.join(nconf_1.default.get('upload_path'), 'system', 'site-logo-x50.png'));
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                // For whatever reason the x50 logo wasn't generated, gracefully error out
                winston_1.default.warn('[logo] The email-safe logo doesn\'t seem to have been created, please re-upload your site logo.');
                size = {
                    height: 0,
                    width: 0,
                };
            }
            else {
                throw err;
            }
        }
        data['brand:emailLogo'] = nconf_1.default.get('url') + path_1.default.join(nconf_1.default.get('upload_url'), 'system', 'site-logo-x50.png');
        data['brand:emailLogo:height'] = size.height;
        data['brand:emailLogo:width'] = size.width;
    });
}
function updateConfig(config) {
    updateLocalConfig(config);
    pubsub.publish('config:update', config);
}
function updateLocalConfig(config) {
    // @ts-ignore
    Object.assign(Meta.config, config);
}
pubsub.on('config:update', (config) => {
    // @ts-ignore
    if (typeof config === 'object' && Meta.config) {
        updateLocalConfig(config);
    }
});
exports.default = Configs;
