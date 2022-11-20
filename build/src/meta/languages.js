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
exports.build = void 0;
const _ = require('lodash');
const nconf_1 = __importDefault(require("nconf"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const util = require('util');
let mkdirp = require('mkdirp');
mkdirp = mkdirp.hasOwnProperty('native') ? mkdirp : util.promisify(mkdirp);
const rimraf = require('rimraf');
const rimrafAsync = util.promisify(rimraf);
const file = require('../file');
const Plugins = require('../plugins');
const { paths } = require('../constants');
const buildLanguagesPath = path_1.default.join(paths.baseDir, 'build/public/language');
const coreLanguagesPath = path_1.default.join(paths.baseDir, 'public/language');
function getTranslationMetadata() {
    return __awaiter(this, void 0, void 0, function* () {
        const paths = yield file.walk(coreLanguagesPath);
        let languages = [];
        let namespaces = [];
        paths.forEach((p) => {
            if (!p.endsWith('.json')) {
                return;
            }
            const rel = path_1.default.relative(coreLanguagesPath, p).split(/[/\\]/);
            const language = rel.shift().replace('_', '-').replace('@', '-x-');
            const namespace = rel.join('/').replace(/\.json$/, '');
            if (!language || !namespace) {
                return;
            }
            languages.push(language);
            namespaces.push(namespace);
        });
        languages = _.union(languages, Plugins.languageData.languages).sort().filter(Boolean);
        namespaces = _.union(namespaces, Plugins.languageData.namespaces).sort().filter(Boolean);
        const configLangs = nconf_1.default.get('languages');
        if (process.env.NODE_ENV === 'development' && Array.isArray(configLangs) && configLangs.length) {
            languages = configLangs;
        }
        // save a list of languages to `${buildLanguagesPath}/metadata.json`
        // avoids readdirs later on
        yield mkdirp(buildLanguagesPath);
        const result = {
            languages: languages,
            namespaces: namespaces,
        };
        yield fs.promises.writeFile(path_1.default.join(buildLanguagesPath, 'metadata.json'), JSON.stringify(result));
        return result;
    });
}
function writeLanguageFile(language, namespace, translations) {
    return __awaiter(this, void 0, void 0, function* () {
        const dev = process.env.NODE_ENV === 'development';
        const filePath = path_1.default.join(buildLanguagesPath, language, `${namespace}.json`);
        yield mkdirp(path_1.default.dirname(filePath));
        yield fs.promises.writeFile(filePath, JSON.stringify(translations, null, dev ? 2 : 0));
    });
}
// for each language and namespace combination,
// run through core and all plugins to generate
// a full translation hash
function buildTranslations(ref) {
    return __awaiter(this, void 0, void 0, function* () {
        const { namespaces } = ref;
        const { languages } = ref;
        const plugins = _.values(Plugins.pluginsData).filter(plugin => typeof plugin.languages === 'string');
        const promises = [];
        namespaces.forEach((namespace) => {
            languages.forEach((language) => {
                promises.push(buildNamespaceLanguage(language, namespace, plugins));
            });
        });
        yield Promise.all(promises);
    });
}
function buildNamespaceLanguage(lang, namespace, plugins) {
    return __awaiter(this, void 0, void 0, function* () {
        const translations = {};
        // core first
        yield assignFileToTranslations(translations, path_1.default.join(coreLanguagesPath, lang, `${namespace}.json`));
        yield Promise.all(plugins.map(pluginData => addPlugin(translations, pluginData, lang, namespace)));
        if (Object.keys(translations).length) {
            yield writeLanguageFile(lang, namespace, translations);
        }
    });
}
function addPlugin(translations, pluginData, lang, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        // if plugin doesn't have this namespace no need to continue
        if (pluginData.languageData && !pluginData.languageData.namespaces.includes(namespace)) {
            return;
        }
        const pathToPluginLanguageFolder = path_1.default.join(paths.nodeModules, pluginData.id, pluginData.languages);
        const defaultLang = pluginData.defaultLang || 'en-GB';
        // for each plugin, fallback in this order:
        //  1. correct language string (en-GB)
        //  2. old language string (en_GB)
        //  3. corrected plugin defaultLang (en-US)
        //  4. old plugin defaultLang (en_US)
        const langs = _.uniq([
            defaultLang.replace('-', '_').replace('-x-', '@'),
            defaultLang.replace('_', '-').replace('@', '-x-'),
            lang.replace('-', '_').replace('-x-', '@'),
            lang,
        ]);
        for (const language of langs) {
            /* eslint-disable no-await-in-loop */
            yield assignFileToTranslations(translations, path_1.default.join(pathToPluginLanguageFolder, language, `${namespace}.json`));
        }
    });
}
function assignFileToTranslations(translations, path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fileData = yield fs.promises.readFile(path, 'utf8');
            Object.assign(translations, JSON.parse(fileData));
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
    });
}
const build = function buildLanguages() {
    return __awaiter(this, void 0, void 0, function* () {
        yield rimrafAsync(buildLanguagesPath);
        const data = yield getTranslationMetadata();
        yield buildTranslations(data);
    });
};
exports.build = build;
