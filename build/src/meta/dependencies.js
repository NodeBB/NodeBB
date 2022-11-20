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
const fs = __importStar(require("fs"));
const semver = require('semver');
const winston_1 = __importDefault(require("winston"));
const chalk = require('chalk');
const pkg = require('../../../package.json');
const { paths, pluginNamePattern } = require('../constants');
const Dependencies = {};
let depsMissing = false;
let depsOutdated = false;
Dependencies.check = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const modules = Object.keys(pkg.dependencies);
        winston_1.default.verbose('Checking dependencies for outdated modules');
        yield Promise.all(modules.map(module => Dependencies.checkModule(module)));
        if (depsMissing) {
            throw new Error('dependencies-missing');
        }
        else if (depsOutdated && global.env !== 'development') {
            throw new Error('dependencies-out-of-date');
        }
    });
};
Dependencies.checkModule = function (moduleName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let pkgData = yield fs.promises.readFile(path_1.default.join(paths.nodeModules, moduleName, 'package.json'), 'utf8');
            pkgData = Dependencies.parseModuleData(moduleName, pkgData);
            const satisfies = Dependencies.doesSatisfy(pkgData, pkg.dependencies[moduleName]);
            return satisfies;
        }
        catch (err) {
            if (err.code === 'ENOENT' && pluginNamePattern.test(moduleName)) {
                winston_1.default.warn(`[meta/dependencies] Bundled plugin ${moduleName} not found, skipping dependency check.`);
                return true;
            }
            throw err;
        }
    });
};
Dependencies.parseModuleData = function (moduleName, pkgData) {
    try {
        pkgData = JSON.parse(pkgData);
    }
    catch (e) {
        winston_1.default.warn(`[${chalk.red('missing')}] ${chalk.bold(moduleName)} is a required dependency but could not be found\n`);
        depsMissing = true;
        return null;
    }
    return pkgData;
};
Dependencies.doesSatisfy = function (moduleData, packageJSONVersion) {
    if (!moduleData) {
        return false;
    }
    const versionOk = !semver.validRange(packageJSONVersion) || semver.satisfies(moduleData.version, packageJSONVersion);
    const githubRepo = moduleData._resolved && moduleData._resolved.includes('//github.com');
    const satisfies = versionOk || githubRepo;
    if (!satisfies) {
        winston_1.default.warn(`[${chalk.yellow('outdated')}] ${chalk.bold(moduleData.name)} installed v${moduleData.version}, package.json requires ${packageJSONVersion}\n`);
        depsOutdated = true;
    }
    return satisfies;
};
exports.default = Dependencies;
