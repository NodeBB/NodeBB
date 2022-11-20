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
const util = require('util');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const rimrafAsync = util.promisify(rimraf);
const file = require('../file');
const plugins = require('../plugins');
const minifier = require('./minifier');
const JS = {};
JS.scripts = {
    base: [
        'node_modules/@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput.js',
        'node_modules/jquery-serializeobject/jquery.serializeObject.js',
        'node_modules/jquery-deserialize/src/jquery.deserialize.js',
        'public/vendor/bootbox/wrapper.js',
    ],
    // plugins add entries into this object,
    // they get linked into /build/public/src/modules
    modules: {},
};
const basePath = path_1.default.resolve(__dirname, '../..');
function linkModules() {
    return __awaiter(this, void 0, void 0, function* () {
        const { modules } = JS.scripts;
        yield Promise.all([
            mkdirp(path_1.default.join(__dirname, '../../build/public/src/admin/plugins')),
            mkdirp(path_1.default.join(__dirname, '../../build/public/src/client/plugins')),
        ]);
        yield Promise.all(Object.keys(modules).map((relPath) => __awaiter(this, void 0, void 0, function* () {
            const srcPath = path_1.default.join(__dirname, '../../', modules[relPath]);
            const destPath = path_1.default.join(__dirname, '../../build/public/src/modules', relPath);
            const [stats] = yield Promise.all([
                fs.promises.stat(srcPath),
                mkdirp(path_1.default.dirname(destPath)),
            ]);
            if (stats.isDirectory()) {
                yield file.linkDirs(srcPath, destPath, true);
            }
            else {
                yield fs.promises.copyFile(srcPath, destPath);
            }
        })));
    });
}
const moduleDirs = ['modules', 'admin', 'client'];
function clearModules() {
    return __awaiter(this, void 0, void 0, function* () {
        const builtPaths = moduleDirs.map(p => path_1.default.join(__dirname, '../../build/public/src', p));
        yield Promise.all(builtPaths.map(builtPath => rimrafAsync(builtPath)));
    });
}
JS.buildModules = function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield clearModules();
        const fse = require('fs-extra');
        yield fse.copy(path_1.default.join(__dirname, `../../../public/src`), path_1.default.join(__dirname, `../../build/public/src`));
        yield linkModules();
    });
};
JS.linkStatics = function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield rimrafAsync(path_1.default.join(__dirname, '../../build/public/plugins'));
        yield Promise.all(Object.keys(plugins.staticDirs).map((mappedPath) => __awaiter(this, void 0, void 0, function* () {
            const sourceDir = plugins.staticDirs[mappedPath];
            const destDir = path_1.default.join(__dirname, '../../build/public/plugins', mappedPath);
            yield mkdirp(path_1.default.dirname(destDir));
            yield file.linkDirs(sourceDir, destDir, true);
        })));
    });
};
function getBundleScriptList(target) {
    return __awaiter(this, void 0, void 0, function* () {
        const pluginDirectories = [];
        if (target === 'admin') {
            target = 'acp';
        }
        let pluginScripts = plugins[`${target}Scripts`].filter((path) => {
            if (path.endsWith('.js')) {
                return true;
            }
            pluginDirectories.push(path);
            return false;
        });
        yield Promise.all(pluginDirectories.map((directory) => __awaiter(this, void 0, void 0, function* () {
            const scripts = yield file.walk(directory);
            pluginScripts = pluginScripts.concat(scripts);
        })));
        pluginScripts = JS.scripts.base.concat(pluginScripts).map((script) => {
            const srcPath = path_1.default.resolve(basePath, script).replace(/\\/g, '/');
            return {
                srcPath: srcPath,
                filename: path_1.default.relative(basePath, srcPath).replace(/\\/g, '/'),
            };
        });
        return pluginScripts;
    });
}
JS.buildBundle = function (target, fork) {
    return __awaiter(this, void 0, void 0, function* () {
        const filename = `scripts-${target}.js`;
        const files = yield getBundleScriptList(target);
        const filePath = path_1.default.join(__dirname, '../../build/public', filename);
        yield minifier.js.bundle({
            files: files,
            filename: filename,
            destPath: filePath,
        }, fork);
    });
};
JS.killMinifier = function () {
    minifier.killAll();
};
exports.default = JS;
