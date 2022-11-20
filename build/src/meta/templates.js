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
const util = require('util');
let mkdirp = require('mkdirp');
mkdirp = mkdirp.hasOwnProperty('native') ? mkdirp : util.promisify(mkdirp);
const rimraf = require('rimraf');
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const Benchpress = require('benchpressjs');
const plugins = require('../plugins');
const file = require('../file');
const { themeNamePattern, paths } = require('../constants');
const viewsPath = nconf_1.default.get('views_dir');
const Templates = {};
function processImports(paths, templatePath, source) {
    return __awaiter(this, void 0, void 0, function* () {
        const regex = /<!-- IMPORT (.+?) -->/;
        const matches = source.match(regex);
        if (!matches) {
            return source;
        }
        const partial = matches[1];
        if (paths[partial] && templatePath !== partial) {
            const partialSource = yield fs.promises.readFile(paths[partial], 'utf8');
            source = source.replace(regex, partialSource);
            return yield processImports(paths, templatePath, source);
        }
        winston_1.default.warn(`[meta/templates] Partial not loaded: ${matches[1]}`);
        source = source.replace(regex, '');
        return yield processImports(paths, templatePath, source);
    });
}
Templates.processImports = processImports;
function getTemplateDirs(activePlugins) {
    return __awaiter(this, void 0, void 0, function* () {
        const pluginTemplates = activePlugins.map((id) => {
            if (themeNamePattern.test(id)) {
                return nconf_1.default.get('theme_templates_path');
            }
            if (!plugins.pluginsData[id]) {
                return '';
            }
            return path_1.default.join(paths.nodeModules, id, plugins.pluginsData[id].templates || 'templates');
        }).filter(Boolean);
        let themeConfig = require(nconf_1.default.get('theme_config'));
        let theme = themeConfig.baseTheme;
        let themePath;
        let themeTemplates = [];
        while (theme) {
            themePath = path_1.default.join(nconf_1.default.get('themes_path'), theme);
            themeConfig = require(path_1.default.join(themePath, 'theme.json'));
            themeTemplates.push(path_1.default.join(themePath, themeConfig.templates || 'templates'));
            theme = themeConfig.baseTheme;
        }
        themeTemplates.push(nconf_1.default.get('base_templates_path'));
        themeTemplates = _.uniq(themeTemplates.reverse());
        const coreTemplatesPath = nconf_1.default.get('core_templates_path');
        let templateDirs = _.uniq([coreTemplatesPath].concat(themeTemplates, pluginTemplates));
        templateDirs = yield Promise.all(templateDirs.map((path) => __awaiter(this, void 0, void 0, function* () { return ((yield file.exists(path)) ? path : false); })));
        return templateDirs.filter(Boolean);
    });
}
function getTemplateFiles(dirs) {
    return __awaiter(this, void 0, void 0, function* () {
        const buckets = yield Promise.all(dirs.map((dir) => __awaiter(this, void 0, void 0, function* () {
            let files = yield file.walk(dir);
            files = files.filter(path => path.endsWith('.tpl')).map(file => ({
                name: path_1.default.relative(dir, file).replace(/\\/g, '/'),
                path: file,
            }));
            return files;
        })));
        const dict = {};
        buckets.forEach((files) => {
            files.forEach((file) => {
                dict[file.name] = file.path;
            });
        });
        return dict;
    });
}
function compileTemplate(filename, source) {
    return __awaiter(this, void 0, void 0, function* () {
        let paths = yield file.walk(viewsPath);
        paths = _.fromPairs(paths.map((p) => {
            const relative = path_1.default.relative(viewsPath, p).replace(/\\/g, '/');
            return [relative, p];
        }));
        source = yield processImports(paths, filename, source);
        const compiled = yield Benchpress.precompile(source, { filename });
        return yield fs.promises.writeFile(path_1.default.join(viewsPath, filename.replace(/\.tpl$/, '.js')), compiled);
    });
}
Templates.compileTemplate = compileTemplate;
function compile() {
    return __awaiter(this, void 0, void 0, function* () {
        const _rimraf = util.promisify(rimraf);
        yield _rimraf(viewsPath);
        yield mkdirp(viewsPath);
        let files = yield plugins.getActive();
        files = yield getTemplateDirs(files);
        files = yield getTemplateFiles(files);
        yield Promise.all(Object.keys(files).map((name) => __awaiter(this, void 0, void 0, function* () {
            const filePath = files[name];
            let imported = yield fs.promises.readFile(filePath, 'utf8');
            imported = yield processImports(files, name, imported);
            yield mkdirp(path_1.default.join(viewsPath, path_1.default.dirname(name)));
            yield fs.promises.writeFile(path_1.default.join(viewsPath, name), imported);
            const compiled = yield Benchpress.precompile(imported, { filename: name });
            yield fs.promises.writeFile(path_1.default.join(viewsPath, name.replace(/\.tpl$/, '.js')), compiled);
        })));
        winston_1.default.verbose('[meta/templates] Successfully compiled templates.');
    });
}
Templates.compile = compile;
exports.default = Templates;
