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
const semver = require('semver');
const nconf_1 = __importDefault(require("nconf"));
const chalk = require('chalk');
const request = require('request-promise-native');
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const meta_1 = __importDefault(require("../meta"));
const { pluginNamePattern, themeNamePattern, paths } = require('../constants');
let app;
let middleware;
const Plugins = {};
require('./install').default(Plugins);
require('./load').default(Plugins);
require('./usage').default(Plugins);
Plugins.data = require('./data').default;
Plugins.hooks = require('./hooks').default;
Plugins.getPluginPaths = Plugins.data.getPluginPaths;
Plugins.loadPluginInfo = Plugins.data.loadPluginInfo;
Plugins.pluginsData = {};
Plugins.libraries = {};
Plugins.loadedHooks = {};
Plugins.staticDirs = {};
Plugins.cssFiles = [];
Plugins.scssFiles = [];
Plugins.acpScssFiles = [];
Plugins.clientScripts = [];
Plugins.acpScripts = [];
Plugins.libraryPaths = [];
Plugins.versionWarning = [];
Plugins.languageData = {};
Plugins.loadedPlugins = [];
Plugins.initialized = false;
Plugins.requireLibrary = function (pluginData) {
    let libraryPath;
    // attempt to load a plugin directly with `require("nodebb-plugin-*")`
    // Plugins should define their entry point in the standard `main` property of `package.json`
    try {
        libraryPath = pluginData.path;
        Plugins.libraries[pluginData.id] = require(libraryPath);
    }
    catch (e) {
        // DEPRECATED: @1.15.0, remove in version >=1.17
        // for backwards compatibility
        // if that fails, fall back to `pluginData.library`
        if (pluginData.library) {
            winston_1.default.warn(`   [plugins/${pluginData.id}] The plugin.json field "library" is deprecated. Please use the package.json field "main" instead.`);
            winston_1.default.verbose(`[plugins/${pluginData.id}] See https://github.com/NodeBB/NodeBB/issues/8686`);
            libraryPath = path_1.default.join(pluginData.path, pluginData.library);
            Plugins.libraries[pluginData.id] = require(libraryPath);
        }
        else {
            throw e;
        }
    }
    Plugins.libraryPaths.push(libraryPath);
};
Plugins.init = function (nbbApp, nbbMiddleware) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Plugins.initialized) {
            return;
        }
        if (nbbApp) {
            app = nbbApp;
            middleware = nbbMiddleware;
        }
        if (global.env === 'development') {
            winston_1.default.verbose('[plugins] Initializing plugins system');
        }
        yield Plugins.reload();
        if (global.env === 'development') {
            winston_1.default.info('[plugins] Plugins OK');
        }
        Plugins.initialized = true;
    });
};
Plugins.reload = function () {
    return __awaiter(this, void 0, void 0, function* () {
        // Resetting all local plugin data
        Plugins.libraries = {};
        Plugins.loadedHooks = {};
        Plugins.staticDirs = {};
        Plugins.versionWarning = [];
        Plugins.cssFiles.length = 0;
        Plugins.scssFiles.length = 0;
        Plugins.acpScssFiles.length = 0;
        Plugins.clientScripts.length = 0;
        Plugins.acpScripts.length = 0;
        Plugins.libraryPaths.length = 0;
        Plugins.loadedPlugins.length = 0;
        yield user_1.default.addInterstitials();
        const paths = yield Plugins.getPluginPaths();
        for (const path of paths) {
            /* eslint-disable no-await-in-loop */
            yield Plugins.loadPlugin(path);
        }
        // If some plugins are incompatible, throw the warning here
        if (Plugins.versionWarning.length && nconf_1.default.get('isPrimary')) {
            console.log('');
            winston_1.default.warn('[plugins/load] The following plugins may not be compatible with your version of NodeBB. This may cause unintended behaviour or crashing. In the event of an unresponsive NodeBB caused by this plugin, run `./nodebb reset -p PLUGINNAME` to disable it.');
            for (let x = 0, numPlugins = Plugins.versionWarning.length; x < numPlugins; x += 1) {
                console.log(`${chalk.yellow('  * ') + Plugins.versionWarning[x]}`);
            }
            console.log('');
        }
        // Core hooks
        posts.registerHooks();
        meta_1.default.configs.registerHooks();
        // Deprecation notices
        Plugins.hooks._deprecated.forEach((deprecation, hook) => {
            if (!deprecation.affected || !deprecation.affected.size) {
                return;
            }
            const replacement = deprecation.hasOwnProperty('new') ? `Please use ${chalk.yellow(deprecation.new)} instead.` : 'There is no alternative.';
            winston_1.default.warn(`[plugins/load] ${chalk.white.bgRed.bold('DEPRECATION')} The hook ${chalk.yellow(hook)} has been deprecated as of ${deprecation.since}, and slated for removal in ${deprecation.until}. ${replacement} The following plugins are still listening for this hook:`);
            deprecation.affected.forEach(id => console.log(`  ${chalk.yellow('*')} ${id}`));
        });
        // Lower priority runs earlier
        Object.keys(Plugins.loadedHooks).forEach((hook) => {
            Plugins.loadedHooks[hook].sort((a, b) => a.priority - b.priority);
        });
        // Post-reload actions
        yield posts.configureSanitize();
    });
};
Plugins.reloadRoutes = function (params) {
    return __awaiter(this, void 0, void 0, function* () {
        const controllers = require('../controllers');
        yield Plugins.hooks.fire('static:app.load', { app: app, router: params.router, middleware: middleware, controllers: controllers });
        winston_1.default.verbose('[plugins] All plugins reloaded and rerouted');
    });
};
Plugins.get = function (id) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `${nconf_1.default.get('registry') || 'https://packages.nodebb.org'}/api/v1/plugins/${id}`;
        const body = yield request(url, {
            json: true,
        });
        let normalised = yield Plugins.normalise([body ? body.payload : {}]);
        normalised = normalised.filter(plugin => plugin.id === id);
        return normalised.length ? normalised[0] : undefined;
    });
};
Plugins.list = function (matching) {
    return __awaiter(this, void 0, void 0, function* () {
        if (matching === undefined) {
            matching = true;
        }
        const { version } = require(paths.currentPackage);
        const url = `${nconf_1.default.get('registry') || 'https://packages.nodebb.org'}/api/v1/plugins${matching !== false ? `?version=${version}` : ''}`;
        try {
            const body = yield request(url, {
                json: true,
            });
            return yield Plugins.normalise(body);
        }
        catch (err) {
            winston_1.default.error(`Error loading ${url}`, err);
            return yield Plugins.normalise([]);
        }
    });
};
Plugins.listTrending = () => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${nconf_1.default.get('registry') || 'https://packages.nodebb.org'}/api/v1/analytics/top/week`;
    return yield request(url, {
        json: true,
    });
});
Plugins.normalise = function (apiReturn) {
    return __awaiter(this, void 0, void 0, function* () {
        const pluginMap = {};
        const { dependencies } = require(paths.currentPackage);
        apiReturn = Array.isArray(apiReturn) ? apiReturn : [];
        apiReturn.forEach((packageData) => {
            packageData.id = packageData.name;
            packageData.installed = false;
            packageData.active = false;
            packageData.url = packageData.url || (packageData.repository ? packageData.repository.url : '');
            pluginMap[packageData.name] = packageData;
        });
        let installedPlugins = yield Plugins.showInstalled();
        installedPlugins = installedPlugins.filter(plugin => plugin && !plugin.system);
        installedPlugins.forEach((plugin) => {
            // If it errored out because a package.json or plugin.json couldn't be read, no need to do this stuff
            if (plugin.error) {
                pluginMap[plugin.id] = pluginMap[plugin.id] || {};
                pluginMap[plugin.id].installed = true;
                pluginMap[plugin.id].error = true;
                return;
            }
            pluginMap[plugin.id] = pluginMap[plugin.id] || {};
            pluginMap[plugin.id].id = pluginMap[plugin.id].id || plugin.id;
            pluginMap[plugin.id].name = plugin.name || pluginMap[plugin.id].name;
            pluginMap[plugin.id].description = plugin.description;
            pluginMap[plugin.id].url = pluginMap[plugin.id].url || plugin.url;
            pluginMap[plugin.id].installed = true;
            pluginMap[plugin.id].isTheme = themeNamePattern.test(plugin.id);
            pluginMap[plugin.id].error = plugin.error || false;
            pluginMap[plugin.id].active = plugin.active;
            pluginMap[plugin.id].version = plugin.version;
            pluginMap[plugin.id].settingsRoute = plugin.settingsRoute;
            pluginMap[plugin.id].license = plugin.license;
            // If package.json defines a version to use, stick to that
            if (dependencies.hasOwnProperty(plugin.id) && semver.valid(dependencies[plugin.id])) {
                pluginMap[plugin.id].latest = dependencies[plugin.id];
            }
            else {
                pluginMap[plugin.id].latest = pluginMap[plugin.id].latest || plugin.version;
            }
            pluginMap[plugin.id].outdated = semver.gt(pluginMap[plugin.id].latest, pluginMap[plugin.id].version);
        });
        const pluginArray = Object.values(pluginMap);
        pluginArray.sort((a, b) => {
            if (a.name > b.name) {
                return 1;
            }
            else if (a.name < b.name) {
                return -1;
            }
            return 0;
        });
        return pluginArray;
    });
};
Plugins.nodeModulesPath = paths.nodeModules;
Plugins.showInstalled = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const dirs = yield fs.promises.readdir(Plugins.nodeModulesPath);
        let pluginPaths = yield findNodeBBModules(dirs);
        pluginPaths = pluginPaths.map(dir => path_1.default.join(Plugins.nodeModulesPath, dir));
        function load(file) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const pluginData = yield Plugins.loadPluginInfo(file);
                    const isActive = yield Plugins.isActive(pluginData.name);
                    delete pluginData.hooks;
                    delete pluginData.library;
                    pluginData.active = isActive;
                    pluginData.installed = true;
                    pluginData.error = false;
                    return pluginData;
                }
                catch (err) {
                    winston_1.default.error(err.stack);
                }
            });
        }
        const plugins = yield Promise.all(pluginPaths.map(file => load(file)));
        return plugins.filter(Boolean);
    });
};
function findNodeBBModules(dirs) {
    return __awaiter(this, void 0, void 0, function* () {
        const pluginPaths = [];
        yield Promise.all(dirs.map((dirname) => __awaiter(this, void 0, void 0, function* () {
            const dirPath = path_1.default.join(Plugins.nodeModulesPath, dirname);
            const isDir = yield isDirectory(dirPath);
            if (!isDir) {
                return;
            }
            if (pluginNamePattern.test(dirname)) {
                pluginPaths.push(dirname);
                return;
            }
            if (dirname[0] === '@') {
                const subdirs = yield fs.promises.readdir(dirPath);
                yield Promise.all(subdirs.map((subdir) => __awaiter(this, void 0, void 0, function* () {
                    if (!pluginNamePattern.test(subdir)) {
                        return;
                    }
                    const subdirPath = path_1.default.join(dirPath, subdir);
                    const isDir = yield isDirectory(subdirPath);
                    if (isDir) {
                        pluginPaths.push(`${dirname}/${subdir}`);
                    }
                })));
            }
        })));
        return pluginPaths;
    });
}
function isDirectory(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield fs.promises.stat(dirPath);
            return stats.isDirectory();
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            return false;
        }
    });
}
require('../promisify').promisify(Plugins);
exports.default = Plugins;
