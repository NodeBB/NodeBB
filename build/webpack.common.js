'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const url = require('url');
const nconf = require('nconf');
const activePlugins = require('./build/active_plugins.json');
let relativePath = nconf.get('relative_path');
if (relativePath === undefined) {
    nconf.file({
        file: path_1.default.resolve(__dirname, nconf.any(['config', 'CONFIG']) || 'config.json'),
    });
    const urlObject = url.parse(nconf.get('url'));
    relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
}
module.exports = {
    plugins: [],
    entry: {
        nodebb: './build/public/src/client.js',
        admin: './build/public/src/admin/admin.js',
    },
    output: {
        filename: '[name].min.js',
        chunkFilename: '[name].[contenthash].min.js',
        path: path_1.default.resolve(__dirname, 'build/public'),
        publicPath: `${relativePath}/assets/`,
        clean: {
            keep(asset) {
                return asset === 'installer.min.js' ||
                    !asset.endsWith('.min.js');
            },
        },
    },
    watchOptions: {
        poll: 500,
        aggregateTimeout: 250,
    },
    performance: {
        maxEntrypointSize: 512000,
        maxAssetSize: 1024000,
    },
    resolve: {
        symlinks: false,
        modules: [
            'build/public/src/modules',
            'build/public/src',
            'node_modules',
            ...activePlugins.map(p => `node_modules/${p}/node_modules`),
        ],
        alias: {
            assets: path_1.default.resolve(__dirname, 'build/public'),
            forum: path_1.default.resolve(__dirname, 'build/public/src/client'),
            admin: path_1.default.resolve(__dirname, 'build/public/src/admin'),
            vendor: path_1.default.resolve(__dirname, 'public/vendor'),
            benchpress: path_1.default.resolve(__dirname, 'node_modules/benchpressjs'),
            Chart: path_1.default.resolve(__dirname, 'node_modules/chart.js'),
            Sortable: path_1.default.resolve(__dirname, 'node_modules/sortablejs'),
            cropper: path_1.default.resolve(__dirname, 'node_modules/cropperjs'),
            'jquery-ui/widgets': path_1.default.resolve(__dirname, 'node_modules/jquery-ui/ui/widgets'),
            'ace/ace': path_1.default.resolve(__dirname, 'build/public/src/modules/ace-editor.js'),
        },
    },
};
