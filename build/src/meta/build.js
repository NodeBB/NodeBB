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
exports.buildAll = exports.webpack = exports.build = void 0;
const os = require('os');
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const path_1 = __importDefault(require("path"));
const mkdirp = require('mkdirp');
const chalk = require('chalk');
const fs = __importStar(require("fs"));
const database_1 = require("../database");
const cacheBuster = require('./cacheBuster');
const { aliases } = require('./aliases');
let meta;
const targetHandlers = {
    'plugin static dirs': function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.js.linkStatics();
        });
    },
    'requirejs modules': function (parallel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.js.buildModules(parallel);
        });
    },
    'client js bundle': function (parallel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.js.buildBundle('client', parallel);
        });
    },
    'admin js bundle': function (parallel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.js.buildBundle('admin', parallel);
        });
    },
    javascript: [
        'plugin static dirs',
        'requirejs modules',
        'client js bundle',
        'admin js bundle',
    ],
    'client side styles': function (parallel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.css.buildBundle('client', parallel);
        });
    },
    'admin control panel styles': function (parallel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.css.buildBundle('admin', parallel);
        });
    },
    styles: [
        'client side styles',
        'admin control panel styles',
    ],
    templates: function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.templates.compile();
        });
    },
    languages: function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield meta.languages.build();
        });
    },
};
const aliasMap = Object.keys(aliases).reduce((prev, key) => {
    const arr = aliases[key];
    arr.forEach((alias) => {
        prev[alias] = key;
    });
    prev[key] = key;
    return prev;
}, {});
function beforeBuild(targets) {
    return __awaiter(this, void 0, void 0, function* () {
        process.stdout.write(`${chalk.green('  started')}\n`);
        try {
            yield database_1.primaryDB.default.init();
            meta = require('./index');
            yield meta.themes.setupPaths();
            const plugins = require('../plugins');
            yield plugins.prepareForBuild(targets);
            yield mkdirp(path_1.default.join(__dirname, '../../build/public'));
        }
        catch (err) {
            winston_1.default.error(`[build] Encountered error preparing for build\n${err.stack}`);
            throw err;
        }
    });
}
const allTargets = Object.keys(targetHandlers).filter(name => typeof targetHandlers[name] === 'function');
function buildTargets(targets, parallel, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const length = Math.max(...targets.map(name => name.length));
        const jsTargets = targets.filter(target => targetHandlers.javascript.includes(target));
        const otherTargets = targets.filter(target => !targetHandlers.javascript.includes(target));
        function buildJSTargets() {
            return __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(jsTargets.map(target => step(target, parallel, `${_.padStart(target, length)} `)));
                // run webpack after jstargets are done, no need to wait for css/templates etc.
                if (options.webpack || options.watch) {
                    (0, exports.webpack)(options);
                }
            });
        }
        if (parallel) {
            yield Promise.all([
                buildJSTargets(),
                ...otherTargets.map(target => step(target, parallel, `${_.padStart(target, length)} `)),
            ]);
        }
        else {
            for (const target of targets) {
                // eslint-disable-next-line no-await-in-loop
                yield step(target, parallel, `${_.padStart(target, length)} `);
            }
            if (options.webpack || options.watch) {
                yield (0, exports.webpack)(options);
            }
        }
    });
}
function step(target, parallel, targetStr) {
    return __awaiter(this, void 0, void 0, function* () {
        const startTime = Date.now();
        winston_1.default.info(`[build] ${targetStr} build started`);
        try {
            yield targetHandlers[target](parallel);
            const time = (Date.now() - startTime) / 1000;
            winston_1.default.info(`[build] ${targetStr} build completed in ${time}sec`);
        }
        catch (err) {
            winston_1.default.error(`[build] ${targetStr} build failed`);
            throw err;
        }
    });
}
const build = function (targets, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!options) {
            options = {};
        }
        if (targets === true) {
            targets = allTargets;
        }
        else if (!Array.isArray(targets)) {
            targets = targets.split(',');
        }
        let series = nconf_1.default.get('series') || options.series;
        if (series === undefined) {
            // Detect # of CPUs and select strategy as appropriate
            winston_1.default.verbose('[build] Querying CPU core count for build strategy');
            const cpus = os.cpus();
            series = cpus.length < 4;
            winston_1.default.verbose(`[build] System returned ${cpus.length} cores, opting for ${series ? 'series' : 'parallel'} build strategy`);
        }
        targets = targets
            // get full target name
            .map((target) => {
            target = target.toLowerCase().replace(/-/g, '');
            if (!aliasMap[target]) {
                winston_1.default.warn(`[build] Unknown target: ${target}`);
                if (target.includes(',')) {
                    winston_1.default.warn('[build] Are you specifying multiple targets? Separate them with spaces:');
                    winston_1.default.warn('[build]   e.g. `./nodebb build adminjs tpl`');
                }
                return false;
            }
            return aliasMap[target];
        })
            // filter nonexistent targets
            .filter(Boolean);
        // map multitargets to their sets
        targets = _.uniq(_.flatMap(targets, target => (Array.isArray(targetHandlers[target]) ?
            targetHandlers[target] :
            target)));
        winston_1.default.verbose(`[build] building the following targets: ${targets.join(', ')}`);
        if (!targets) {
            winston_1.default.info('[build] No valid targets supplied. Aborting.');
            return;
        }
        try {
            yield beforeBuild(targets);
            const threads = parseInt(nconf_1.default.get('threads'), 10);
            if (threads) {
                require('./minifier').maxThreads = threads - 1;
            }
            if (!series) {
                winston_1.default.info('[build] Building in parallel mode');
            }
            else {
                winston_1.default.info('[build] Building in series mode');
            }
            const startTime = Date.now();
            yield buildTargets(targets, !series, options);
            const totalTime = (Date.now() - startTime) / 1000;
            yield cacheBuster.write();
            winston_1.default.info(`[build] Asset compilation successful. Completed in ${totalTime}sec.`);
        }
        catch (err) {
            winston_1.default.error(`[build] Encountered error during build step\n${err.stack ? err.stack : err}`);
            throw err;
        }
    });
};
exports.build = build;
function getWebpackConfig() {
    return require(process.env.NODE_ENV !== 'development' ? '../../webpack.prod' : '../../webpack.dev');
}
const webpack = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        winston_1.default.info(`[build] ${(options.watch ? 'Watching' : 'Bundling')} with Webpack.`);
        const webpack = require('webpack');
        const util = require('util');
        const plugins = require('../plugins/data');
        const activePlugins = (yield plugins.getActive()).map(p => p.id);
        if (!activePlugins.includes('nodebb-plugin-composer-default')) {
            activePlugins.push('nodebb-plugin-composer-default');
        }
        yield fs.promises.writeFile(path_1.default.resolve(__dirname, '../../build/active_plugins.json'), JSON.stringify(activePlugins));
        const webpackCfg = getWebpackConfig();
        const compiler = webpack(webpackCfg);
        const webpackRun = util.promisify(compiler.run).bind(compiler);
        const webpackWatch = util.promisify(compiler.watch).bind(compiler);
        try {
            let stats;
            if (options.watch) {
                stats = yield webpackWatch(webpackCfg.watchOptions);
                compiler.hooks.assetEmitted.tap('nbbWatchPlugin', (file) => {
                    console.log(`webpack:assetEmitted > ${webpackCfg.output.publicPath}${file}`);
                });
            }
            else {
                stats = yield webpackRun();
            }
            if (stats.hasErrors() || stats.hasWarnings()) {
                console.log(stats.toString('minimal'));
            }
            else {
                const statsJson = stats.toJson();
                winston_1.default.info(`[build] ${(options.watch ? 'Watching' : 'Bundling')} took ${statsJson.time} ms`);
            }
        }
        catch (err) {
            console.error(err.stack || err);
            if (err.details) {
                console.error(err.details);
            }
        }
    });
};
exports.webpack = webpack;
const buildAll = function () {
    return __awaiter(this, void 0, void 0, function* () {
        (0, exports.build)(allTargets, { webpack: true });
    });
};
exports.buildAll = buildAll;
require('../promisify').promisify(exports.build);
exports.default = exports.build;
