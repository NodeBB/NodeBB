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
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const fs = __importStar(require("fs"));
const file = require('../file');
const database_1 = __importDefault(require("../database"));
const Meta = require('./index');
const events = require('../events');
const utils = require('../utils');
const { themeNamePattern } = require('../constants');
const Themes = {};
Themes.get = () => __awaiter(void 0, void 0, void 0, function* () {
    const themePath = nconf_1.default.get('themes_path');
    if (typeof themePath !== 'string') {
        return [];
    }
    let themes = yield getThemes(themePath);
    themes = _.flatten(themes).filter(Boolean);
    themes = yield Promise.all(themes.map((theme) => __awaiter(void 0, void 0, void 0, function* () {
        const config = path_1.default.join(themePath, theme, 'theme.json');
        const pack = path_1.default.join(themePath, theme, 'package.json');
        try {
            const [configFile, packageFile] = yield Promise.all([
                fs.promises.readFile(config, 'utf8'),
                fs.promises.readFile(pack, 'utf8'),
            ]);
            const configObj = JSON.parse(configFile);
            const packageObj = JSON.parse(packageFile);
            configObj.id = packageObj.name;
            // Minor adjustments for API output
            configObj.type = 'local';
            if (configObj.screenshot) {
                configObj.screenshot_url = `${nconf_1.default.get('relative_path')}/css/previews/${encodeURIComponent(configObj.id)}`;
            }
            else {
                configObj.screenshot_url = `${nconf_1.default.get('relative_path')}/assets/images/themes/default.png`;
            }
            return configObj;
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            winston_1.default.error(`[themes] Unable to parse theme.json ${theme}`);
            return false;
        }
    })));
    return themes.filter(Boolean);
});
function getThemes(themePath) {
    return __awaiter(this, void 0, void 0, function* () {
        let dirs = yield fs.promises.readdir(themePath);
        dirs = dirs.filter(dir => themeNamePattern.test(dir) || dir.startsWith('@'));
        return yield Promise.all(dirs.map((dir) => __awaiter(this, void 0, void 0, function* () {
            try {
                const dirpath = path_1.default.join(themePath, dir);
                const stat = yield fs.promises.stat(dirpath);
                if (!stat.isDirectory()) {
                    return false;
                }
                if (!dir.startsWith('@')) {
                    return dir;
                }
                const themes = yield getThemes(path_1.default.join(themePath, dir));
                return themes.map(theme => path_1.default.join(dir, theme));
            }
            catch (err) {
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
        })));
    });
}
Themes.set = (data) => __awaiter(void 0, void 0, void 0, function* () {
    switch (data.type) {
        case 'local': {
            const current = yield Meta.configs.get('theme:id');
            yield database_1.default.sortedSetRemove('plugins:active', current);
            const numPlugins = yield database_1.default.sortedSetCard('plugins:active');
            yield database_1.default.sortedSetAdd('plugins:active', numPlugins, data.id);
            if (current !== data.id) {
                const pathToThemeJson = path_1.default.join(nconf_1.default.get('themes_path'), data.id, 'theme.json');
                if (!pathToThemeJson.startsWith(nconf_1.default.get('themes_path'))) {
                    throw new Error('[[error:invalid-theme-id]]');
                }
                let config = yield fs.promises.readFile(pathToThemeJson, 'utf8');
                config = JSON.parse(config);
                const activePluginsConfig = nconf_1.default.get('plugins:active');
                if (!activePluginsConfig) {
                    yield database_1.default.sortedSetRemove('plugins:active', current);
                    const numPlugins = yield database_1.default.sortedSetCard('plugins:active');
                    yield database_1.default.sortedSetAdd('plugins:active', numPlugins, data.id);
                }
                else if (!activePluginsConfig.includes(data.id)) {
                    // This prevents changing theme when configuration doesn't include it, but allows it otherwise
                    winston_1.default.error('When defining active plugins in configuration, changing themes requires adding the new theme to the list of active plugins before updating it in the ACP');
                    throw new Error('[[error:theme-not-set-in-configuration]]');
                }
                // Re-set the themes path (for when NodeBB is reloaded)
                Themes.setPath(config);
                yield Meta.configs.setMultiple({
                    'theme:type': data.type,
                    'theme:id': data.id,
                    'theme:staticDir': config.staticDir ? config.staticDir : '',
                    'theme:templates': config.templates ? config.templates : '',
                    'theme:src': '',
                    bootswatchSkin: '',
                });
                yield events.log({
                    type: 'theme-set',
                    uid: parseInt(data.uid, 10) || 0,
                    ip: data.ip || '127.0.0.1',
                    text: data.id,
                });
                Meta.reloadRequired = true;
            }
            break;
        }
        case 'bootswatch':
            yield Meta.configs.setMultiple({
                'theme:src': data.src,
                bootswatchSkin: data.id.toLowerCase(),
            });
            break;
    }
});
Themes.setupPaths = () => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield utils.promiseParallel({
        themesData: Themes.get(),
        currentThemeId: Meta.configs.get('theme:id'),
    });
    const themeId = data.currentThemeId || 'nodebb-theme-persona';
    if (process.env.NODE_ENV === 'development') {
        winston_1.default.info(`[themes] Using theme ${themeId}`);
    }
    const themeObj = data.themesData.find(themeObj => themeObj.id === themeId);
    if (!themeObj) {
        throw new Error('[[error:theme-not-found]]');
    }
    Themes.setPath(themeObj);
});
Themes.setPath = function (themeObj) {
    // Theme's templates path
    let themePath = nconf_1.default.get('base_templates_path');
    const fallback = path_1.default.join(nconf_1.default.get('themes_path'), themeObj.id, 'templates');
    if (themeObj.templates) {
        themePath = path_1.default.join(nconf_1.default.get('themes_path'), themeObj.id, themeObj.templates);
    }
    else if (file.existsSync(fallback)) {
        themePath = fallback;
    }
    nconf_1.default.set('theme_templates_path', themePath);
    nconf_1.default.set('theme_config', path_1.default.join(nconf_1.default.get('themes_path'), themeObj.id, 'theme.json'));
};
exports.default = Themes;
