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
const path_1 = __importDefault(require("path"));
const fs = require('fs').promises;
const nconf_1 = __importDefault(require("nconf"));
const os = require('os');
const cproc = require('child_process');
const util = require('util');
const request = require('request-promise-native');
const database_1 = require("../database");
const meta_1 = __importDefault(require("../meta"));
const pubsub = require('../pubsub').default;
const { paths } = require('../constants');
const pkgInstall = require('../cli/package-install').default;
const packageManager = pkgInstall.getPackageManager();
let packageManagerExecutable = packageManager;
const packageManagerCommands = {
    yarn: {
        install: 'add',
        uninstall: 'remove',
    },
    npm: {
        install: 'install',
        uninstall: 'uninstall',
    },
    cnpm: {
        install: 'install',
        uninstall: 'uninstall',
    },
    pnpm: {
        install: 'install',
        uninstall: 'uninstall',
    },
};
if (process.platform === 'win32') {
    packageManagerExecutable += '.cmd';
}
function default_1(Plugins) {
    if (nconf_1.default.get('isPrimary')) {
        pubsub.on('plugins:toggleInstall', (data) => {
            if (data.hostname !== os.hostname()) {
                toggleInstall(data.id, data.version);
            }
        });
        pubsub.on('plugins:upgrade', (data) => {
            if (data.hostname !== os.hostname()) {
                upgrade(data.id, data.version);
            }
        });
    }
    Plugins.toggleActive = function (id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (nconf_1.default.get('plugins:active')) {
                winston_1.default.error('Cannot activate plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
                throw new Error('[[error:plugins-set-in-configuration]]');
            }
            const isActive = yield Plugins.isActive(id);
            if (isActive) {
                yield database_1.primaryDB.default.sortedSetRemove('plugins:active', id);
            }
            else {
                const count = yield database_1.primaryDB.default.sortedSetCard('plugins:active');
                yield database_1.primaryDB.default.sortedSetAdd('plugins:active', count, id);
            }
            meta_1.default.reloadRequired = true;
            const hook = isActive ? 'deactivate' : 'activate';
            Plugins.hooks.fire(`action:plugin.${hook}`, { id: id });
            return { id: id, active: !isActive };
        });
    };
    Plugins.checkWhitelist = function (id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield request({
                method: 'GET',
                url: `https://packages.nodebb.org/api/v1/plugins/${encodeURIComponent(id)}`,
                json: true,
            });
            if (body && body.code === 'ok' && (version === 'latest' || body.payload.valid.includes(version))) {
                return;
            }
            throw new Error('[[error:plugin-not-whitelisted]]');
        });
    };
    Plugins.toggleInstall = function (id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            pubsub.publish('plugins:toggleInstall', { hostname: os.hostname(), id: id, version: version });
            return yield toggleInstall(id, version);
        });
    };
    const runPackageManagerCommandAsync = util.promisify(runPackageManagerCommand);
    function toggleInstall(id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            const [installed, active] = yield Promise.all([
                Plugins.isInstalled(id),
                Plugins.isActive(id),
            ]);
            const type = installed ? 'uninstall' : 'install';
            if (active) {
                yield Plugins.toggleActive(id);
            }
            yield runPackageManagerCommandAsync(type, id, version || 'latest');
            const pluginData = yield Plugins.get(id);
            Plugins.hooks.fire(`action:plugin.${type}`, { id: id, version: version });
            return pluginData;
        });
    }
    function runPackageManagerCommand(command, pkgName, version, callback) {
        cproc.execFile(packageManagerExecutable, [
            packageManagerCommands[packageManager][command],
            pkgName + (command === 'install' ? `@${version}` : ''),
            '--save',
        ], (err, stdout) => {
            if (err) {
                return callback(err);
            }
            winston_1.default.verbose(`[plugins/${command}] ${stdout}`);
            callback();
        });
    }
    Plugins.upgrade = function (id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            pubsub.publish('plugins:upgrade', { hostname: os.hostname(), id: id, version: version });
            return yield upgrade(id, version);
        });
    };
    function upgrade(id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            yield runPackageManagerCommandAsync('install', id, version || 'latest');
            const isActive = yield Plugins.isActive(id);
            meta_1.default.reloadRequired = isActive;
            return isActive;
        });
    }
    Plugins.isInstalled = function (id) {
        return __awaiter(this, void 0, void 0, function* () {
            const pluginDir = path_1.default.join(paths.nodeModules, id);
            try {
                const stats = yield fs.stat(pluginDir);
                return stats.isDirectory();
            }
            catch (err) {
                return false;
            }
        });
    };
    Plugins.isActive = function (id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (nconf_1.default.get('plugins:active')) {
                return nconf_1.default.get('plugins:active').includes(id);
            }
            return yield database_1.primaryDB.default.isSortedSetMember('plugins:active', id);
        });
    };
    Plugins.getActive = function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (nconf_1.default.get('plugins:active')) {
                return nconf_1.default.get('plugins:active');
            }
            return yield database_1.primaryDB.default.getSortedSetRange('plugins:active', 0, -1);
        });
    };
    Plugins.autocomplete = (fragment) => __awaiter(this, void 0, void 0, function* () {
        const pluginDir = paths.nodeModules;
        const plugins = (yield fs.readdir(pluginDir)).filter(filename => filename.startsWith(fragment));
        // Autocomplete only if single match
        return plugins.length === 1 ? plugins.pop() : fragment;
    });
}
exports.default = default_1;
;
