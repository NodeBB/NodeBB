'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeNamePattern = exports.pluginNamePattern = exports.paths = void 0;
const path_1 = __importDefault(require("path"));
const baseDir = path_1.default.join(__dirname, '../');
const rootDir = path_1.default.join(__dirname, '../../');
const loader = path_1.default.join(baseDir, 'loader.js');
const app = path_1.default.join(baseDir, 'build/app.js');
const pidfile = path_1.default.join(baseDir, 'pidfile');
const config = path_1.default.join(baseDir, 'config.json');
const currentPackage = path_1.default.join(baseDir, 'package.json');
const installPackage = path_1.default.join(baseDir, 'install/package.json');
const nodeModules = path_1.default.join(rootDir, 'node_modules');
exports.paths = {
    baseDir,
    loader,
    app,
    pidfile,
    config,
    currentPackage,
    installPackage,
    nodeModules,
};
exports.pluginNamePattern = /^(@[\w-]+\/)?nodebb-(theme|plugin|widget|rewards)-[\w-]+$/;
exports.themeNamePattern = /^(@[\w-]+\/)?nodebb-theme-[\w-]+$/;
