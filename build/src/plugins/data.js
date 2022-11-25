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
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const nconf_1 = __importDefault(require("nconf"));
const database = __importStar(require("../database"));
const db = database;
const file = require('../file');
const { paths } = require('../constants');
const Data = {};
const basePath = path_1.default.join(__dirname, '../../');
// to get this functionality use `plugins.getActive()` from `src/plugins/install.js` instead
// this method duplicates that one, because requiring that file here would have side effects
function getActiveIds() {
    return __awaiter(this, void 0, void 0, function* () {
        if (nconf_1.default.get('plugins:active')) {
            return nconf_1.default.get('plugins:active');
        }
        return yield db.getSortedSetRange('plugins:active', 0, -1);
    });
}
Data.getPluginPaths = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const plugins = yield getActiveIds();
        const pluginPaths = plugins.filter(plugin => plugin && typeof plugin === 'string')
            .map(plugin => path_1.default.join(paths.nodeModules, plugin));
        const exists = yield Promise.all(pluginPaths.map(file.exists));
        exists.forEach((exists, i) => {
            if (!exists) {
                winston_1.default.warn(`[plugins] "${plugins[i]}" is active but not installed.`);
            }
        });
        return pluginPaths.filter((p, i) => exists[i]);
    });
};
Data.loadPluginInfo = function (pluginPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const [packageJson, pluginJson] = yield Promise.all([
            fs.promises.readFile(path_1.default.join(pluginPath, 'package.json'), 'utf8'),
            fs.promises.readFile(path_1.default.join(pluginPath, 'plugin.json'), 'utf8'),
        ]);
        let pluginData;
        let packageData;
        try {
            pluginData = JSON.parse(pluginJson);
            packageData = JSON.parse(packageJson);
            pluginData.license = parseLicense(packageData);
            pluginData.id = packageData.name;
            pluginData.name = packageData.name;
            pluginData.description = packageData.description;
            pluginData.version = packageData.version;
            pluginData.repository = packageData.repository;
            pluginData.nbbpm = packageData.nbbpm;
            pluginData.path = pluginPath;
        }
        catch (err) {
            const pluginDir = path_1.default.basename(pluginPath);
            winston_1.default.error(`[plugins/${pluginDir}] Error in plugin.json or package.json!${err.stack}`);
            throw new Error('[[error:parse-error]]');
        }
        return pluginData;
    });
};
function parseLicense(packageData) {
    try {
        const licenseData = require(`spdx-license-list/licenses/${packageData.license}`);
        return {
            name: licenseData.name,
            text: licenseData.licenseText,
        };
    }
    catch (e) {
        // No license matched
        return null;
    }
}
Data.getActive = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const pluginPaths = yield Data.getPluginPaths();
        return yield Promise.all(pluginPaths.map(p => Data.loadPluginInfo(p)));
    });
};
Data.getStaticDirectories = function (pluginData) {
    return __awaiter(this, void 0, void 0, function* () {
        const validMappedPath = /^[\w\-_]+$/;
        if (!pluginData.staticDirs) {
            return;
        }
        const dirs = Object.keys(pluginData.staticDirs);
        if (!dirs.length) {
            return;
        }
        const staticDirs = {};
        function processDir(route) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!validMappedPath.test(route)) {
                    winston_1.default.warn(`[plugins/${pluginData.id}] Invalid mapped path specified: ${route}. Path must adhere to: ${validMappedPath.toString()}`);
                    return;
                }
                const dirPath = yield resolveModulePath(pluginData.path, pluginData.staticDirs[route]);
                if (!dirPath) {
                    winston_1.default.warn(`[plugins/${pluginData.id}] Invalid mapped path specified: ${route} => ${pluginData.staticDirs[route]}`);
                    return;
                }
                try {
                    const stats = yield fs.promises.stat(dirPath);
                    if (!stats.isDirectory()) {
                        winston_1.default.warn(`[plugins/${pluginData.id}] Mapped path '${route} => ${dirPath}' is not a directory.`);
                        return;
                    }
                    staticDirs[`${pluginData.id}/${route}`] = dirPath;
                }
                catch (err) {
                    if (err.code === 'ENOENT') {
                        winston_1.default.warn(`[plugins/${pluginData.id}] Mapped path '${route} => ${dirPath}' not found.`);
                        return;
                    }
                    throw err;
                }
            });
        }
        yield Promise.all(dirs.map(route => processDir(route)));
        winston_1.default.verbose(`[plugins] found ${Object.keys(staticDirs).length} static directories for ${pluginData.id}`);
        return staticDirs;
    });
};
Data.getFiles = function (pluginData, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(pluginData[type]) || !pluginData[type].length) {
            return;
        }
        winston_1.default.verbose(`[plugins] Found ${pluginData[type].length} ${type} file(s) for plugin ${pluginData.id}`);
        return pluginData[type].map(file => path_1.default.join(pluginData.id, file));
    });
};
/**
 * With npm@3, dependencies can become flattened, and appear at the root level.
 * This method resolves these differences if it can.
 */
function resolveModulePath(basePath, modulePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const isNodeModule = /node_modules/;
        const currentPath = path_1.default.join(basePath, modulePath);
        const exists = yield file.exists(currentPath);
        if (exists) {
            return currentPath;
        }
        if (!isNodeModule.test(modulePath)) {
            winston_1.default.warn(`[plugins] File not found: ${currentPath} (Ignoring)`);
            return;
        }
        const dirPath = path_1.default.dirname(basePath);
        if (dirPath === basePath) {
            winston_1.default.warn(`[plugins] File not found: ${currentPath} (Ignoring)`);
            return;
        }
        return yield resolveModulePath(dirPath, modulePath);
    });
}
Data.getScripts = function getScripts(pluginData, target) {
    return __awaiter(this, void 0, void 0, function* () {
        target = (target === 'client') ? 'scripts' : 'acpScripts';
        const input = pluginData[target];
        if (!Array.isArray(input) || !input.length) {
            return;
        }
        const scripts = [];
        for (const filePath of input) {
            /* eslint-disable no-await-in-loop */
            const modulePath = yield resolveModulePath(pluginData.path, filePath);
            if (modulePath) {
                scripts.push(modulePath);
            }
        }
        if (scripts.length) {
            winston_1.default.verbose(`[plugins] Found ${scripts.length} js file(s) for plugin ${pluginData.id}`);
        }
        return scripts;
    });
};
Data.getModules = function getModules(pluginData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!pluginData.modules || !pluginData.hasOwnProperty('modules')) {
            return;
        }
        let pluginModules = pluginData.modules;
        if (Array.isArray(pluginModules)) {
            const strip = parseInt(pluginData.modulesStrip, 10) || 0;
            pluginModules = pluginModules.reduce((prev, modulePath) => {
                let key;
                if (strip) {
                    key = modulePath.replace(new RegExp(`.?(/[^/]+){${strip}}/`), '');
                }
                else {
                    key = path_1.default.basename(modulePath);
                }
                prev[key] = modulePath;
                return prev;
            }, {});
        }
        const modules = {};
        function processModule(key) {
            return __awaiter(this, void 0, void 0, function* () {
                const modulePath = yield resolveModulePath(pluginData.path, pluginModules[key]);
                if (modulePath) {
                    modules[key] = path_1.default.relative(basePath, modulePath);
                }
            });
        }
        yield Promise.all(Object.keys(pluginModules).map(key => processModule(key)));
        const len = Object.keys(modules).length;
        winston_1.default.verbose(`[plugins] Found ${len} AMD-style module(s) for plugin ${pluginData.id}`);
        return modules;
    });
};
Data.getLanguageData = function getLanguageData(pluginData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof pluginData.languages !== 'string') {
            return;
        }
        const pathToFolder = path_1.default.join(paths.nodeModules, pluginData.id, pluginData.languages);
        const filepaths = yield file.walk(pathToFolder);
        const namespaces = [];
        const languages = [];
        filepaths.forEach((p) => {
            const rel = path_1.default.relative(pathToFolder, p).split(/[/\\]/);
            const language = rel.shift().replace('_', '-').replace('@', '-x-');
            const namespace = rel.join('/').replace(/\.json$/, '');
            if (!language || !namespace) {
                return;
            }
            languages.push(language);
            namespaces.push(namespace);
        });
        return {
            languages: _.uniq(languages),
            namespaces: _.uniq(namespaces),
        };
    });
};
exports.default = Data;
