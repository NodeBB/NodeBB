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
exports.upgrade = void 0;
const nconf_1 = __importDefault(require("nconf"));
const chalk = require('chalk');
const packageInstall = require('./package-install');
const { upgradePlugins } = require('./upgrade-plugins');
const steps = {
    package: {
        message: 'Updating package.json file with defaults...',
        handler: function () {
            packageInstall.updatePackageFile();
            packageInstall.preserveExtraneousPlugins();
            process.stdout.write(chalk.green('  OK\n'));
        },
    },
    install: {
        message: 'Bringing base dependencies up to date...',
        handler: function () {
            process.stdout.write(chalk.green('  started\n'));
            packageInstall.installAll();
        },
    },
    plugins: {
        message: 'Checking installed plugins for updates...',
        handler: function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield require('../database').init();
                yield upgradePlugins();
            });
        },
    },
    schema: {
        message: 'Updating NodeBB data store schema...',
        handler: function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield require('../database').init();
                yield require('../meta').configs.init();
                yield require('../upgrade').run();
            });
        },
    },
    build: {
        message: 'Rebuilding assets...',
        handler: function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield require('../meta/build').buildAll();
            });
        },
    },
};
function runSteps(tasks) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            for (let i = 0; i < tasks.length; i++) {
                const step = steps[tasks[i]];
                if (step && step.message && step.handler) {
                    process.stdout.write(`\n${chalk.bold(`${i + 1}. `)}${chalk.yellow(step.message)}`);
                    /* eslint-disable-next-line */
                    yield step.handler();
                }
            }
            const message = 'NodeBB Upgrade Complete!';
            // some consoles will return undefined/zero columns,
            // so just use 2 spaces in upgrade script if we can't get our column count
            const { columns } = process.stdout;
            const spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';
            console.log(`\n\n${spaces}${chalk.green.bold(message)}\n`);
            process.exit();
        }
        catch (err) {
            console.error(`Error occurred during upgrade: ${err.stack}`);
            throw err;
        }
    });
}
function runUpgrade(upgrades, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk.cyan('\nUpdating NodeBB...'));
        options = options || {};
        // disable mongo timeouts during upgrade
        nconf_1.default.set('mongo:options:socketTimeoutMS', 0);
        if (upgrades === true) {
            let tasks = Object.keys(steps);
            if (options.package || options.install ||
                options.plugins || options.schema || options.build) {
                tasks = tasks.filter(key => options[key]);
            }
            yield runSteps(tasks);
            return;
        }
        yield require('../database').init();
        yield require('../meta').configs.init();
        yield require('../upgrade').runParticular(upgrades);
        process.exit(0);
    });
}
exports.upgrade = runUpgrade;
