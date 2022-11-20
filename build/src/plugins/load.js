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
const semver = require('semver');
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const meta_1 = __importDefault(require("../meta"));
const { themeNamePattern } = require('../constants');
function default_1(Plugins) {
    function registerPluginAssets(pluginData, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            function add(dest, arr) {
                dest.push(...(arr || []));
            }
            const handlers = {
                staticDirs: function (next) {
                    Plugins.data.getStaticDirectories(pluginData, next);
                },
                cssFiles: function (next) {
                    Plugins.data.getFiles(pluginData, 'css', next);
                },
                scssFiles: function (next) {
                    Plugins.data.getFiles(pluginData, 'scss', next);
                },
                acpScssFiles: function (next) {
                    Plugins.data.getFiles(pluginData, 'acpScss', next);
                },
                clientScripts: function (next) {
                    Plugins.data.getScripts(pluginData, 'client', next);
                },
                acpScripts: function (next) {
                    Plugins.data.getScripts(pluginData, 'acp', next);
                },
                modules: function (next) {
                    Plugins.data.getModules(pluginData, next);
                },
                languageData: function (next) {
                    Plugins.data.getLanguageData(pluginData, next);
                },
            };
            let methods = {};
            if (Array.isArray(fields)) {
                fields.forEach((field) => {
                    methods[field] = handlers[field];
                });
            }
            else {
                methods = handlers;
            }
            const results = yield async.parallel(methods);
            Object.assign(Plugins.staticDirs, results.staticDirs || {});
            add(Plugins.cssFiles, results.cssFiles);
            add(Plugins.scssFiles, results.scssFiles);
            add(Plugins.acpScssFiles, results.acpScssFiles);
            add(Plugins.clientScripts, results.clientScripts);
            add(Plugins.acpScripts, results.acpScripts);
            Object.assign(meta_1.default.js.scripts.modules, results.modules || {});
            if (results.languageData) {
                Plugins.languageData.languages = _.union(Plugins.languageData.languages, results.languageData.languages);
                Plugins.languageData.namespaces = _.union(Plugins.languageData.namespaces, results.languageData.namespaces);
                pluginData.languageData = results.languageData;
            }
            Plugins.pluginsData[pluginData.id] = pluginData;
        });
    }
    Plugins.prepareForBuild = function (targets) {
        return __awaiter(this, void 0, void 0, function* () {
            const map = {
                'plugin static dirs': ['staticDirs'],
                'requirejs modules': ['modules'],
                'client js bundle': ['clientScripts'],
                'admin js bundle': ['acpScripts'],
                'client side styles': ['cssFiles', 'scssFiles'],
                'admin control panel styles': ['cssFiles', 'scssFiles', 'acpScssFiles'],
                languages: ['languageData'],
            };
            const fields = _.uniq(_.flatMap(targets, target => map[target] || []));
            // clear old data before build
            fields.forEach((field) => {
                switch (field) {
                    case 'clientScripts':
                    case 'acpScripts':
                    case 'cssFiles':
                    case 'scssFiles':
                    case 'acpScssFiles':
                        Plugins[field].length = 0;
                        break;
                    case 'languageData':
                        Plugins.languageData.languages = [];
                        Plugins.languageData.namespaces = [];
                        break;
                    // do nothing for modules and staticDirs
                }
            });
            winston_1.default.verbose(`[plugins] loading the following fields from plugin data: ${fields.join(', ')}`);
            const plugins = yield Plugins.data.getActive();
            yield Promise.all(plugins.map(p => registerPluginAssets(p, fields)));
        });
    };
    Plugins.loadPlugin = function (pluginPath) {
        return __awaiter(this, void 0, void 0, function* () {
            let pluginData;
            try {
                pluginData = yield Plugins.data.loadPluginInfo(pluginPath);
            }
            catch (err) {
                if (err.message === '[[error:parse-error]]') {
                    return;
                }
                if (!themeNamePattern.test(pluginPath)) {
                    throw err;
                }
                return;
            }
            checkVersion(pluginData);
            try {
                registerHooks(pluginData);
                yield registerPluginAssets(pluginData);
            }
            catch (err) {
                winston_1.default.error(err.stack);
                winston_1.default.verbose(`[plugins] Could not load plugin : ${pluginData.id}`);
                return;
            }
            if (!pluginData.private) {
                Plugins.loadedPlugins.push({
                    id: pluginData.id,
                    version: pluginData.version,
                });
            }
            winston_1.default.verbose(`[plugins] Loaded plugin: ${pluginData.id}`);
        });
    };
    function checkVersion(pluginData) {
        function add() {
            if (!Plugins.versionWarning.includes(pluginData.id)) {
                Plugins.versionWarning.push(pluginData.id);
            }
        }
        if (pluginData.nbbpm && pluginData.nbbpm.compatibility && semver.validRange(pluginData.nbbpm.compatibility)) {
            if (!semver.satisfies(nconf_1.default.get('version'), pluginData.nbbpm.compatibility)) {
                add();
            }
        }
        else {
            add();
        }
    }
    function registerHooks(pluginData) {
        try {
            if (!Plugins.libraries[pluginData.id]) {
                Plugins.requireLibrary(pluginData);
            }
            if (Array.isArray(pluginData.hooks)) {
                pluginData.hooks.forEach(hook => Plugins.hooks.register(pluginData.id, hook));
            }
        }
        catch (err) {
            winston_1.default.warn(`[plugins] Unable to load library for: ${pluginData.id}`);
            throw err;
        }
    }
}
exports.default = default_1;
;
