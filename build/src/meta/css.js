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
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const fs = __importStar(require("fs"));
const util = require('util');
const path_1 = __importDefault(require("path"));
const rimraf = require('rimraf');
const rimrafAsync = util.promisify(rimraf);
const plugins = require('../plugins');
const database = __importStar(require("../database"));
const db = database;
const file = require('../file');
const minifier = require('./minifier');
const CSS = {};
CSS.supportedSkins = [
    'cerulean', 'cosmo', 'cyborg', 'darkly', 'flatly', 'journal', 'litera',
    'lumen', 'lux', 'materia', 'minty', 'morph', 'pulse', 'quartz', 'sandstone',
    'simplex', 'sketchy', 'slate', 'solar', 'spacelab', 'superhero', 'united',
    'vapor', 'yeti', 'zephyr',
];
const buildImports = {
    client: function (source, themeData) {
        return [
            '@import "mixins";',
            '@import "fontawesome";',
            '@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
            boostrapImport(themeData),
            '@import "generics";',
            '@import "responsive-utilities";',
            source,
            '@import "jquery-ui";',
            '@import "cropperjs/dist/cropper";',
            '@import "client";',
        ].join('\n');
    },
    admin: function (source) {
        console.log('SOURCE', source);
        return [
            '@import "admin/vars";',
            '@import "bootswatch/dist/materia/variables";',
            '@import "bootstrap/scss/bootstrap";',
            '@import "bootswatch/dist/materia/bootswatch";',
            '@import "mixins";',
            '@import "fontawesome";',
            '@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
            '@import "generics";',
            '@import "responsive-utilities";',
            '@import "admin/admin";',
            source,
            '@import "jquery-ui";',
        ].join('\n');
    },
};
function boostrapImport(themeData) {
    // see https://getbootstrap.com/docs/5.0/customize/sass/#variable-defaults
    // for an explanation of this order and https://bootswatch.com/help/
    const { bootswatchSkin } = themeData;
    return [
        bootswatchSkin ? `@import "bootswatch/dist/${bootswatchSkin}/variables";` : '',
        '@import "bootstrap/scss/mixins/banner";',
        '@include bsBanner("");',
        // functions must be included first
        '@import "bootstrap/scss/functions";',
        // overrides for bs5 variables
        '@import "./scss/overrides";',
        '@import "../../public/scss/overrides.scss";',
        // bs files
        '@import "bootstrap/scss/variables";',
        '@import "bootstrap/scss/maps";',
        '@import "bootstrap/scss/mixins";',
        '@import "bootstrap/scss/utilities";',
        // Layout & components
        '@import "bootstrap/scss/root";',
        '@import "bootstrap/scss/reboot";',
        '@import "bootstrap/scss/type";',
        '@import "bootstrap/scss/images";',
        '@import "bootstrap/scss/containers";',
        '@import "bootstrap/scss/grid";',
        '@import "bootstrap/scss/tables";',
        '@import "bootstrap/scss/forms";',
        '@import "bootstrap/scss/buttons";',
        '@import "bootstrap/scss/transitions";',
        '@import "bootstrap/scss/dropdown";',
        '@import "bootstrap/scss/button-group";',
        '@import "bootstrap/scss/nav";',
        '@import "bootstrap/scss/navbar";',
        '@import "bootstrap/scss/card";',
        '@import "bootstrap/scss/accordion";',
        '@import "bootstrap/scss/breadcrumb";',
        '@import "bootstrap/scss/pagination";',
        '@import "bootstrap/scss/badge";',
        '@import "bootstrap/scss/alert";',
        '@import "bootstrap/scss/progress";',
        '@import "bootstrap/scss/list-group";',
        '@import "bootstrap/scss/close";',
        '@import "bootstrap/scss/toasts";',
        '@import "bootstrap/scss/modal";',
        '@import "bootstrap/scss/tooltip";',
        '@import "bootstrap/scss/popover";',
        '@import "bootstrap/scss/carousel";',
        '@import "bootstrap/scss/spinners";',
        '@import "bootstrap/scss/offcanvas";',
        '@import "bootstrap/scss/placeholders";',
        // Helpers
        '@import "bootstrap/scss/helpers";',
        // Utilities
        '@import "bootstrap/scss/utilities/api";',
        // scss-docs-end import-stack
        '@import "./theme";',
        bootswatchSkin ? `@import "bootswatch/dist/${bootswatchSkin}/bootswatch";` : '',
    ].join('\n');
}
function filterMissingFiles(filepaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield Promise.all(filepaths.map((filepath) => __awaiter(this, void 0, void 0, function* () {
            const exists = yield file.exists(path_1.default.join(__dirname, '../../node_modules', filepath));
            if (!exists) {
                winston_1.default.warn(`[meta/css] File not found! ${filepath}`);
            }
            return exists;
        })));
        return filepaths.filter((filePath, i) => exists[i]);
    });
}
function getImports(files, extension) {
    return __awaiter(this, void 0, void 0, function* () {
        const pluginDirectories = [];
        let source = '';
        function pathToImport(file) {
            if (!file) {
                return '';
            }
            // trim css extension so it inlines the css like less (inline)
            const parsed = path_1.default.parse(file);
            const newFile = path_1.default.join(parsed.dir, parsed.name);
            return `\n@import "${newFile.replace(/\\/g, '/')}";`;
        }
        files.forEach((styleFile) => {
            if (styleFile.endsWith(extension)) {
                source += pathToImport(styleFile);
            }
            else {
                pluginDirectories.push(styleFile);
            }
        });
        yield Promise.all(pluginDirectories.map((directory) => __awaiter(this, void 0, void 0, function* () {
            const styleFiles = yield file.walk(directory);
            styleFiles.forEach((styleFile) => {
                source += pathToImport(styleFile);
            });
        })));
        return source;
    });
}
function getBundleMetadata(target) {
    return __awaiter(this, void 0, void 0, function* () {
        const paths = [
            path_1.default.join(__dirname, '../../node_modules'),
            path_1.default.join(__dirname, '../../../public/scss'),
            path_1.default.join(__dirname, '../../../public/vendor/fontawesome/scss'),
        ];
        // Skin support
        let skin;
        if (target.startsWith('client-')) {
            skin = target.split('-')[1];
            if (CSS.supportedSkins.includes(skin)) {
                target = 'client';
            }
        }
        let themeData = null;
        if (target === 'client') {
            themeData = (yield db.getObjectFields('config', ['theme:type', 'theme:id', 'bootswatchSkin']));
            const themeId = (themeData['theme:id'] || 'nodebb-theme-persona');
            const baseThemePath = path_1.default.join(nconf_1.default.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-persona'));
            paths.unshift(baseThemePath);
            themeData.bootswatchSkin = skin || themeData.bootswatchSkin;
        }
        const [scssImports, cssImports, acpScssImports] = yield Promise.all([
            filterGetImports(plugins.scssFiles, '.scss'),
            filterGetImports(plugins.cssFiles, '.css'),
            target === 'client' ? '' : filterGetImports(plugins.acpScssFiles, '.scss'),
        ]);
        function filterGetImports(files, extension) {
            return __awaiter(this, void 0, void 0, function* () {
                const filteredFiles = yield filterMissingFiles(files);
                return yield getImports(filteredFiles, extension);
            });
        }
        let imports = `${cssImports}\n${scssImports}\n${acpScssImports}`;
        imports = buildImports[target](imports, themeData);
        return { paths: paths, imports: imports };
    });
}
CSS.buildBundle = function (target, fork) {
    return __awaiter(this, void 0, void 0, function* () {
        if (target === 'client') {
            yield rimrafAsync(path_1.default.join(__dirname, '../../build/public/client*'));
        }
        const data = yield getBundleMetadata(target);
        const minify = process.env.NODE_ENV !== 'development';
        const { ltr, rtl } = yield minifier.css.bundle(data.imports, data.paths, minify, fork);
        yield Promise.all([
            fs.promises.writeFile(path_1.default.join(__dirname, '../../build/public', `${target}.css`), ltr.code),
            fs.promises.writeFile(path_1.default.join(__dirname, '../../build/public', `${target}-rtl.css`), rtl.code),
        ]);
        return [ltr.code, rtl.code];
    });
};
exports.default = CSS;
