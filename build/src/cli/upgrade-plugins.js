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
exports.upgradePlugins = void 0;
const prompt = require('prompt');
const request = require('request-promise-native');
const cproc = require('child_process');
const semver = require('semver');
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk = require('chalk');
const { paths, pluginNamePattern } = require('../constants');
const pkgInstall = require('./package-install');
const packageManager = pkgInstall.getPackageManager();
let packageManagerExecutable = packageManager;
const packageManagerInstallArgs = packageManager === 'yarn' ? ['add'] : ['install', '--save'];
if (process.platform === 'win32') {
    packageManagerExecutable += '.cmd';
}
function getModuleVersions(modules) {
    return __awaiter(this, void 0, void 0, function* () {
        const versionHash = {};
        const batch = require('../batch');
        yield batch.processArray(modules, (moduleNames) => __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(moduleNames.map((module) => __awaiter(this, void 0, void 0, function* () {
                let pkg = yield fs.promises.readFile(path_1.default.join(paths.nodeModules, module, 'package.json'), { encoding: 'utf-8' });
                pkg = JSON.parse(pkg);
                versionHash[module] = pkg.version;
            })));
        }), {
            batch: 50,
        });
        return versionHash;
    });
}
function getInstalledPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        let [deps, bundled] = yield Promise.all([
            fs.promises.readFile(paths.currentPackage, { encoding: 'utf-8' }),
            fs.promises.readFile(paths.installPackage, { encoding: 'utf-8' }),
        ]);
        deps = Object.keys(JSON.parse(deps).dependencies)
            .filter(pkgName => pluginNamePattern.test(pkgName));
        bundled = Object.keys(JSON.parse(bundled).dependencies)
            .filter(pkgName => pluginNamePattern.test(pkgName));
        // Whittle down deps to send back only extraneously installed plugins/themes/etc
        const checklist = deps.filter((pkgName) => {
            if (bundled.includes(pkgName)) {
                return false;
            }
            // Ignore git repositories
            try {
                fs.accessSync(path_1.default.join(paths.nodeModules, pkgName, '.git'));
                return false;
            }
            catch (e) {
                return true;
            }
        });
        return yield getModuleVersions(checklist);
    });
}
function getCurrentVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        let pkg = yield fs.promises.readFile(paths.installPackage, { encoding: 'utf-8' });
        pkg = JSON.parse(pkg);
        return pkg.version;
    });
}
function getSuggestedModules(nbbVersion, toCheck) {
    return __awaiter(this, void 0, void 0, function* () {
        let body = yield request({
            method: 'GET',
            url: `https://packages.nodebb.org/api/v1/suggest?version=${nbbVersion}&package[]=${toCheck.join('&package[]=')}`,
            json: true,
        });
        if (!Array.isArray(body) && toCheck.length === 1) {
            body = [body];
        }
        return body;
    });
}
function checkPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        process.stdout.write('Checking installed plugins and themes for updates... ');
        const [plugins, nbbVersion] = yield Promise.all([
            getInstalledPlugins(),
            getCurrentVersion(),
        ]);
        const toCheck = Object.keys(plugins);
        if (!toCheck.length) {
            process.stdout.write(chalk.green('  OK'));
            return []; // no extraneous plugins installed
        }
        const suggestedModules = yield getSuggestedModules(nbbVersion, toCheck);
        process.stdout.write(chalk.green('  OK'));
        let current;
        let suggested;
        const upgradable = suggestedModules.map((suggestObj) => {
            current = plugins[suggestObj.package];
            suggested = suggestObj.version;
            if (suggestObj.code === 'match-found' && semver.gt(suggested, current)) {
                return {
                    name: suggestObj.package,
                    current: current,
                    suggested: suggested,
                };
            }
            return null;
        }).filter(Boolean);
        return upgradable;
    });
}
function upgradePlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const found = yield checkPlugins();
            if (found && found.length) {
                process.stdout.write(`\n\nA total of ${chalk.bold(String(found.length))} package(s) can be upgraded:\n\n`);
                found.forEach((suggestObj) => {
                    process.stdout.write(`${chalk.yellow('  * ') + suggestObj.name} (${chalk.yellow(suggestObj.current)} -> ${chalk.green(suggestObj.suggested)})\n`);
                });
            }
            else {
                console.log(chalk.green('\nAll packages up-to-date!'));
                return;
            }
            prompt.message = '';
            prompt.delimiter = '';
            prompt.start();
            const result = yield prompt.get({
                name: 'upgrade',
                description: '\nProceed with upgrade (y|n)?',
                type: 'string',
            });
            if (['y', 'Y', 'yes', 'YES'].includes(result.upgrade)) {
                console.log('\nUpgrading packages...');
                const args = packageManagerInstallArgs.concat(found.map((suggestObj) => `${suggestObj.name}@${suggestObj.suggested}`));
                cproc.execFileSync(packageManagerExecutable, args, { stdio: 'ignore' });
            }
            else {
                console.log(`${chalk.yellow('Package upgrades skipped')}. Check for upgrades at any time by running "${chalk.green('./nodebb upgrade -p')}".`);
            }
        }
        catch (err) {
            console.log(`${chalk.yellow('Warning')}: An unexpected error occured when attempting to verify plugin upgradability`);
            throw err;
        }
    });
}
exports.upgradePlugins = upgradePlugins;
