'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionCheck = exports.loadConfig = exports.setupWinston = void 0;
const nconf_1 = __importDefault(require("nconf"));
const url = require('url');
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const chalk = require('chalk');
const pkg = require('../../package.json');
const { paths } = require('./constants');
function setupWinston() {
    if (!winston_1.default.format) {
        return;
    }
    const formats = [];
    if (nconf_1.default.get('log-colorize') !== 'false') {
        formats.push(winston_1.default.format.colorize());
    }
    if (nconf_1.default.get('json-logging')) {
        formats.push(winston_1.default.format.timestamp());
        formats.push(winston_1.default.format.json());
    }
    else {
        const timestampFormat = winston_1.default.format((info) => {
            const dateString = `${new Date().toISOString()} [${nconf_1.default.get('port')}/${global.process.pid}]`;
            info.level = `${dateString} - ${info.level}`;
            return info;
        });
        formats.push(timestampFormat());
        formats.push(winston_1.default.format.splat());
        formats.push(winston_1.default.format.simple());
    }
    winston_1.default.configure({
        level: nconf_1.default.get('log-level') || (process.env.NODE_ENV === 'production' ? 'info' : 'verbose'),
        format: winston_1.default.format.combine.apply(null, formats),
        transports: [
            new winston_1.default.transports.Console({
                handleExceptions: true,
            }),
        ],
    });
}
exports.setupWinston = setupWinston;
function loadConfig(configFile) {
    nconf_1.default.file({
        file: configFile,
    });
    nconf_1.default.defaults({
        base_dir: paths.baseDir,
        themes_path: paths.nodeModules,
        upload_path: 'public/uploads',
        views_dir: path_1.default.join(paths.baseDir, 'build/public/templates'),
        version: pkg.version,
        isCluster: false,
        isPrimary: true,
        jobsDisabled: false,
    });
    // Explicitly cast as Bool, loader.js passes in isCluster as string 'true'/'false'
    const castAsBool = ['isCluster', 'isPrimary', 'jobsDisabled'];
    nconf_1.default.stores.env.readOnly = false;
    castAsBool.forEach((prop) => {
        const value = nconf_1.default.get(prop);
        if (value !== undefined) {
            nconf_1.default.set(prop, ['1', 1, 'true', true].includes(value));
        }
    });
    nconf_1.default.stores.env.readOnly = true;
    nconf_1.default.set('runJobs', nconf_1.default.get('isPrimary') && !nconf_1.default.get('jobsDisabled'));
    // Ensure themes_path is a full filepath
    nconf_1.default.set('themes_path', path_1.default.resolve(paths.baseDir, nconf_1.default.get('themes_path')));
    nconf_1.default.set('core_templates_path', path_1.default.join(paths.baseDir, 'src/views'));
    nconf_1.default.set('base_templates_path', path_1.default.join(nconf_1.default.get('themes_path'), 'nodebb-theme-persona/templates'));
    nconf_1.default.set('upload_path', path_1.default.resolve(nconf_1.default.get('base_dir'), nconf_1.default.get('upload_path')));
    nconf_1.default.set('upload_url', '/assets/uploads');
    // nconf defaults, if not set in config
    if (!nconf_1.default.get('sessionKey')) {
        nconf_1.default.set('sessionKey', 'express.sid');
    }
    console.log('NCONF GET URL', nconf_1.default.set('url', 'http://localhost:4567'));
    if (nconf_1.default.get('url')) {
        nconf_1.default.set('url', nconf_1.default.get('url').replace(/\/$/, ''));
        nconf_1.default.set('url_parsed', url.parse(nconf_1.default.get('url')));
        // Parse out the relative_url and other goodies from the configured URL
        const urlObject = url.parse(nconf_1.default.get('url'));
        const relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
        nconf_1.default.set('base_url', `${urlObject.protocol}//${urlObject.host}`);
        nconf_1.default.set('secure', urlObject.protocol === 'https:');
        nconf_1.default.set('use_port', !!urlObject.port);
        nconf_1.default.set('relative_path', relativePath);
        if (!nconf_1.default.get('asset_base_url')) {
            nconf_1.default.set('asset_base_url', `${relativePath}/assets`);
        }
        nconf_1.default.set('port', nconf_1.default.get('PORT') || nconf_1.default.get('port') || urlObject.port || (nconf_1.default.get('PORT_ENV_VAR') ? nconf_1.default.get(nconf_1.default.get('PORT_ENV_VAR')) : false) || 4567);
        // cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
        const domain = nconf_1.default.get('cookieDomain') || urlObject.hostname;
        const origins = nconf_1.default.get('socket.io:origins') || `${urlObject.protocol}//${domain}:*`;
        nconf_1.default.set('socket.io:origins', origins);
    }
}
exports.loadConfig = loadConfig;
function versionCheck() {
    const version = process.version.slice(1);
    const range = pkg.engines.node;
    const semver = require('semver');
    const compatible = semver.satisfies(version, range);
    if (!compatible) {
        winston_1.default.warn('Your version of Node.js is too outdated for NodeBB. Please update your version of Node.js.');
        winston_1.default.warn(`Recommended ${chalk.green(range)}, ${chalk.yellow(version)} provided\n`);
    }
}
exports.versionCheck = versionCheck;
