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
exports.buildWrapper = exports.info = exports.listEvents = exports.listPlugins = exports.activate = void 0;
const winston_1 = __importDefault(require("winston"));
const CliGraph = require('cli-graph');
const chalk = require('chalk');
const nconf_1 = __importDefault(require("nconf"));
const build_1 = require("../meta/build");
const database = __importStar(require("../database"));
const db = database;
const plugins = require('../plugins');
const events = require('../events');
const analytics = require('../analytics');
const reset = require('./reset');
const { pluginNamePattern, themeNamePattern } = require('../constants');
function activate(plugin) {
    return __awaiter(this, void 0, void 0, function* () {
        if (themeNamePattern.test(plugin)) {
            yield reset.reset({
                theme: plugin,
            });
            process.exit();
        }
        try {
            yield db.init();
            if (!pluginNamePattern.test(plugin)) {
                // Allow omission of `nodebb-plugin-`
                plugin = `nodebb-plugin-${plugin}`;
            }
            plugin = yield plugins.autocomplete(plugin);
            const isInstalled = yield plugins.isInstalled(plugin);
            if (!isInstalled) {
                throw new Error('plugin not installed');
            }
            const isActive = yield plugins.isActive(plugin);
            if (isActive) {
                winston_1.default.info('Plugin `%s` already active', plugin);
                process.exit(0);
            }
            if (nconf_1.default.get('plugins:active')) {
                winston_1.default.error('Cannot activate plugins while plugin state configuration is set, please change your active configuration (config.json, environmental variables or terminal arguments) instead');
                process.exit(1);
            }
            const numPlugins = yield db.sortedSetCard('plugins:active');
            winston_1.default.info('Activating plugin `%s`', plugin);
            yield db.sortedSetAdd('plugins:active', numPlugins, plugin);
            yield events.log({
                type: 'plugin-activate',
                text: plugin,
            });
            process.exit(0);
        }
        catch (err) {
            winston_1.default.error(`An error occurred during plugin activation\n${err.stack}`);
            process.exit(1);
        }
    });
}
exports.activate = activate;
function listPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.init();
        const installed = yield plugins.showInstalled();
        const installedList = installed.map(plugin => plugin.name);
        const active = yield plugins.getActive();
        // Merge the two sets, defer to plugins in  `installed` if already present
        const combined = installed.concat(active.reduce((memo, cur) => {
            if (!installedList.includes(cur)) {
                memo.push({
                    id: cur,
                    active: true,
                    installed: false,
                });
            }
            return memo;
        }, []));
        // Alphabetical sort
        combined.sort((a, b) => (a.id > b.id ? 1 : -1));
        // Pretty output
        process.stdout.write('Active plugins:\n');
        combined.forEach((plugin) => {
            process.stdout.write(`\t* ${plugin.id}${plugin.version ? `@${plugin.version}` : ''} (`);
            process.stdout.write(plugin.installed ? chalk.green('installed') : chalk.red('not installed'));
            process.stdout.write(', ');
            process.stdout.write(plugin.active ? chalk.green('enabled') : chalk.yellow('disabled'));
            process.stdout.write(')\n');
        });
        process.exit();
    });
}
exports.listPlugins = listPlugins;
function listEvents(count = 10) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.init();
        const eventData = yield events.getEvents('', 0, count - 1);
        console.log(chalk.bold(`\nDisplaying last ${count} administrative events...`));
        eventData.forEach((event) => {
            console.log(`  * ${chalk.green(String(event.timestampISO))} ${chalk.yellow(String(event.type))}${event.text ? ` ${event.text}` : ''} (uid: ${event.uid ? event.uid : 0})`);
        });
        process.exit();
    });
}
exports.listEvents = listEvents;
function info() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('');
        const { version } = require('../../package.json');
        console.log(`  version:  ${version}`);
        console.log(`  Node ver: ${process.version}`);
        // @ts-ignore
        const hash = child(process).execSync('git rev-parse HEAD');
        console.log(`  git hash: ${hash}`);
        console.log(`  database: ${nconf_1.default.get('database')}`);
        yield db.init();
        const info = yield db.info(db.client);
        switch (nconf_1.default.get('database')) {
            case 'redis':
                console.log(`        version: ${info.redis_version}`);
                console.log(`        disk sync:  ${info.rdb_last_bgsave_status}`);
                break;
            case 'mongo':
                console.log(`        version: ${info.version}`);
                console.log(`        engine:  ${info.storageEngine}`);
                break;
            case 'postgres':
                console.log(`        version: ${info.version}`);
                console.log(`        uptime:  ${info.uptime}`);
                break;
        }
        const analyticsData = yield analytics.getHourlyStatsForSet('analytics:pageviews', Date.now(), 24);
        const graph = new CliGraph({
            height: 12,
            width: 25,
            center: {
                x: 0,
                y: 11,
            },
        });
        const min = Math.min(...analyticsData);
        const max = Math.max(...analyticsData);
        analyticsData.forEach((point, idx) => {
            graph.addPoint(idx + 1, Math.round(point / max * 10));
        });
        console.log(graph.toString());
        console.log(`Pageviews, last 24h (min: ${min}  max: ${max})`);
        process.exit();
    });
}
exports.info = info;
function buildWrapper(targets, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, build_1.build)(targets, options);
            process.exit(0);
        }
        catch (err) {
            winston_1.default.error(err.stack);
            process.exit(1);
        }
    });
}
exports.buildWrapper = buildWrapper;
