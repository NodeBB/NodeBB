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
exports.reset = void 0;
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const fs = __importStar(require("fs"));
const chalk = require('chalk');
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const events = require('../events');
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const widgets = require('../widgets');
const privileges = require('../privileges');
const { paths, pluginNamePattern, themeNamePattern } = require('../constants');
const reset = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = {
            theme: function () {
                return __awaiter(this, void 0, void 0, function* () {
                    let themeId = options.theme;
                    if (themeId === true) {
                        yield resetThemes();
                    }
                    else {
                        if (!themeNamePattern.test(themeId)) {
                            // Allow omission of `nodebb-theme-`
                            themeId = `nodebb-theme-${themeId}`;
                        }
                        themeId = yield plugins.autocomplete(themeId);
                        yield resetTheme(themeId);
                    }
                });
            },
            plugin: function () {
                return __awaiter(this, void 0, void 0, function* () {
                    let pluginId = options.plugin;
                    if (pluginId === true) {
                        yield resetPlugins();
                    }
                    else {
                        if (!pluginNamePattern.test(pluginId)) {
                            // Allow omission of `nodebb-plugin-`
                            pluginId = `nodebb-plugin-${pluginId}`;
                        }
                        pluginId = yield plugins.autocomplete(pluginId);
                        yield resetPlugin(pluginId);
                    }
                });
            },
            widgets: resetWidgets,
            settings: resetSettings,
            all: function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield resetWidgets();
                    yield resetThemes();
                    yield resetPlugin();
                    yield resetSettings();
                });
            },
        };
        const tasks = Object.keys(map).filter(x => options[x]).map(x => map[x]);
        if (!tasks.length) {
            console.log([
                chalk.yellow('No arguments passed in, so nothing was reset.\n'),
                `Use ./nodebb reset ${chalk.red('{-t|-p|-w|-s|-a}')}`,
                '    -t\tthemes',
                '    -p\tplugins',
                '    -w\twidgets',
                '    -s\tsettings',
                '    -a\tall of the above',
                '',
                'Plugin and theme reset flags (-p & -t) can take a single argument',
                '    e.g. ./nodebb reset -p nodebb-plugin-mentions, ./nodebb reset -t nodebb-theme-persona',
                '         Prefix is optional, e.g. ./nodebb reset -p markdown, ./nodebb reset -t persona',
            ].join('\n'));
            process.exit(0);
        }
        try {
            yield database_1.default.init();
            for (const task of tasks) {
                /* eslint-disable no-await-in-loop */
                yield task();
            }
            winston_1.default.info('[reset] Reset complete. Please run `./nodebb build` to rebuild assets.');
            process.exit(0);
        }
        catch (err) {
            winston_1.default.error(`[reset] Errors were encountered during reset -- ${err.message}`);
            process.exit(1);
        }
    });
};
exports.reset = reset;
function resetSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        yield privileges.global.give(['groups:local:login'], 'registered-users');
        winston_1.default.info('[reset] registered-users given login privilege');
        winston_1.default.info('[reset] Settings reset to default');
    });
}
function resetTheme(themeId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.promises.access(path_1.default.join(paths.nodeModules, themeId, 'package.json'));
        }
        catch (err) {
            winston_1.default.warn('[reset] Theme `%s` is not installed on this forum', themeId);
            throw new Error('theme-not-found');
        }
        yield resetThemeTo(themeId);
    });
}
function resetThemes() {
    return __awaiter(this, void 0, void 0, function* () {
        yield resetThemeTo('nodebb-theme-persona');
    });
}
function resetThemeTo(themeId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield meta_1.default.themes.set({
            type: 'local',
            id: themeId,
        });
        yield meta_1.default.configs.set('bootswatchSkin', '');
        winston_1.default.info(`[reset] Theme reset to ${themeId} and default skin`);
    });
}
function resetPlugin(pluginId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (nconf_1.default.get('plugins:active')) {
                winston_1.default.error('Cannot reset plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
                process.exit(1);
            }
            const isActive = yield database_1.default.isSortedSetMember('plugins:active', pluginId);
            if (isActive) {
                yield database_1.default.sortedSetRemove('plugins:active', pluginId);
                yield events.log({
                    type: 'plugin-deactivate',
                    text: pluginId,
                });
                winston_1.default.info('[reset] Plugin `%s` disabled', pluginId);
            }
            else {
                winston_1.default.warn('[reset] Plugin `%s` was not active on this forum', pluginId);
                winston_1.default.info('[reset] No action taken.');
            }
        }
        catch (err) {
            winston_1.default.error(`[reset] Could not disable plugin: ${pluginId} encountered error %s\n${err.stack}`);
            throw err;
        }
    });
}
function resetPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        if (nconf_1.default.get('plugins:active')) {
            winston_1.default.error('Cannot reset plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
            process.exit(1);
        }
        yield database_1.default.delete('plugins:active');
        winston_1.default.info('[reset] All Plugins De-activated');
    });
}
function resetWidgets() {
    return __awaiter(this, void 0, void 0, function* () {
        yield plugins.reload();
        yield widgets.reset();
        winston_1.default.info('[reset] All Widgets moved to Draft Zone');
    });
}
