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
const fs = __importStar(require("fs"));
const url = require('url');
const path_1 = __importDefault(require("path"));
const prompt = require('prompt');
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const database_1 = require("./database");
const groups_1 = __importDefault(require("./groups"));
const privileges_1 = __importDefault(require("./privileges"));
const utils_1 = __importDefault(require("./utils"));
const file_1 = __importDefault(require("./file"));
const upgrade_1 = __importDefault(require("./upgrade"));
const install = {};
const questions = {};
questions.main = [
    {
        name: 'url',
        description: 'URL used to access this NodeBB',
        default: nconf_1.default.get('url') || 'http://localhost:4567',
        pattern: /^http(?:s)?:\/\//,
        message: 'Base URL must begin with \'http://\' or \'https://\'',
    },
    {
        name: 'secret',
        description: 'Please enter a NodeBB secret',
        default: nconf_1.default.get('secret') || utils_1.default.generateUUID(),
    },
    {
        name: 'submitPluginUsage',
        description: 'Would you like to submit anonymous plugin usage to nbbpm?',
        default: 'yes',
    },
    {
        name: 'database',
        description: 'Which database to use',
        default: nconf_1.default.get('database') || 'mongo',
    },
];
questions.optional = [
    {
        name: 'port',
        default: nconf_1.default.get('port') || 4567,
    },
];
function checkSetupFlagEnv() {
    let setupVal = install.values;
    const envConfMap = {
        NODEBB_URL: 'url',
        NODEBB_PORT: 'port',
        NODEBB_ADMIN_USERNAME: 'admin:username',
        NODEBB_ADMIN_PASSWORD: 'admin:password',
        NODEBB_ADMIN_EMAIL: 'admin:email',
        NODEBB_DB: 'database',
        NODEBB_DB_HOST: 'host',
        NODEBB_DB_PORT: 'port',
        NODEBB_DB_USER: 'username',
        NODEBB_DB_PASSWORD: 'password',
        NODEBB_DB_NAME: 'database',
        NODEBB_DB_SSL: 'ssl',
    };
    // Set setup values from env vars (if set)
    const envKeys = Object.keys(process.env);
    if (Object.keys(envConfMap).some(key => envKeys.includes(key))) {
        winston_1.default.info('[install/checkSetupFlagEnv] checking env vars for setup info...');
        setupVal = setupVal || {};
        Object.entries(process.env).forEach(([evName, evValue]) => {
            if (evName.startsWith('NODEBB_DB_')) {
                setupVal[`${process.env.NODEBB_DB}:${envConfMap[evName]}`] = evValue;
            }
            else if (evName.startsWith('NODEBB_')) {
                setupVal[envConfMap[evName]] = evValue;
            }
        });
        setupVal['admin:password:confirm'] = setupVal['admin:password'];
    }
    // try to get setup values from json, if successful this overwrites all values set by env
    // TODO: better behaviour would be to support overrides per value, i.e. in order of priority (generic pattern):
    //       flag, env, config file, default
    try {
        if (nconf_1.default.get('setup')) {
            const setupJSON = JSON.parse(nconf_1.default.get('setup'));
            setupVal = Object.assign(Object.assign({}, setupVal), setupJSON);
        }
    }
    catch (err) {
        winston_1.default.error('[install/checkSetupFlagEnv] invalid json in nconf.get(\'setup\'), ignoring setup values from json');
    }
    if (setupVal && typeof setupVal === 'object') {
        if (setupVal['admin:username'] && setupVal['admin:password'] && setupVal['admin:password:confirm'] && setupVal['admin:email']) {
            install.values = setupVal;
        }
        else {
            winston_1.default.error('[install/checkSetupFlagEnv] required values are missing for automated setup:');
            if (!setupVal['admin:username']) {
                winston_1.default.error('  admin:username');
            }
            if (!setupVal['admin:password']) {
                winston_1.default.error('  admin:password');
            }
            if (!setupVal['admin:password:confirm']) {
                winston_1.default.error('  admin:password:confirm');
            }
            if (!setupVal['admin:email']) {
                winston_1.default.error('  admin:email');
            }
            process.exit();
        }
    }
    else if (nconf_1.default.get('database')) {
        install.values = install.values || {};
        install.values.database = nconf_1.default.get('database');
    }
}
function checkCIFlag() {
    let ciVals;
    try {
        ciVals = JSON.parse(nconf_1.default.get('ci'));
    }
    catch (e) {
        ciVals = undefined;
    }
    if (ciVals && ciVals instanceof Object) {
        if (ciVals.hasOwnProperty('host') && ciVals.hasOwnProperty('port') && ciVals.hasOwnProperty('database')) {
            install.ciVals = ciVals;
        }
        else {
            winston_1.default.error('[install/checkCIFlag] required values are missing for automated CI integration:');
            if (!ciVals.hasOwnProperty('host')) {
                winston_1.default.error('  host');
            }
            if (!ciVals.hasOwnProperty('port')) {
                winston_1.default.error('  port');
            }
            if (!ciVals.hasOwnProperty('database')) {
                winston_1.default.error('  database');
            }
            process.exit();
        }
    }
}
function setupConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        const configureDatabases = require('../install/databases');
        // prompt prepends "prompt: " to questions, let's clear that.
        prompt.start();
        prompt.message = '';
        prompt.delimiter = '';
        prompt.colors = false;
        let config = {};
        if (install.values) {
            // Use provided values, fall back to defaults
            const redisQuestions = require('./database/redis').default.questions;
            const mongoQuestions = require('./database/mongo').default.questions;
            const postgresQuestions = require('./database/postgres').default.questions;
            const allQuestions = [
                ...questions.main,
                ...questions.optional,
                ...redisQuestions,
                ...mongoQuestions,
                ...postgresQuestions,
            ];
            allQuestions.forEach((question) => {
                if (install.values.hasOwnProperty(question.name)) {
                    config[question.name] = install.values[question.name];
                }
                else if (question.hasOwnProperty('default')) {
                    config[question.name] = question.default;
                }
                else {
                    config[question.name] = undefined;
                }
            });
        }
        else {
            config = yield prompt.get(questions.main);
        }
        yield configureDatabases(config);
        yield completeConfigSetup(config);
    });
}
function completeConfigSetup(config) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add CI object
        if (install.ciVals) {
            config.test_database = Object.assign({}, install.ciVals);
        }
        // Add package_manager object if set
        if (nconf_1.default.get('package_manager')) {
            config.package_manager = nconf_1.default.get('package_manager');
        }
        nconf_1.default.overrides(config);
        yield database_1.primaryDB.default.init();
        if (database_1.primaryDB.default.hasOwnProperty('createIndices')) {
            yield database_1.primaryDB.default.createIndices();
        }
        // Sanity-check/fix url/port
        if (!/^http(?:s)?:\/\//.test(config.url)) {
            config.url = `http://${config.url}`;
        }
        // If port is explicitly passed via install vars, use it. Otherwise, glean from url if set.
        const urlObj = url.parse(config.url);
        if (urlObj.port && (!install.values || !install.values.hasOwnProperty('port'))) {
            config.port = urlObj.port;
        }
        // Remove trailing slash from non-subfolder installs
        if (urlObj.path === '/') {
            urlObj.path = '';
            urlObj.pathname = '';
        }
        config.url = url.format(urlObj);
        // ref: https://github.com/indexzero/nconf/issues/300
        delete config.type;
        const meta = require('./meta').default;
        yield meta.config.set('submitPluginUsage', config.submitPluginUsage === 'yes' ? 1 : 0);
        delete config.submitPluginUsage;
        yield install.save(config);
    });
}
function setupDefaultConfigs() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Populating database with default configs, if not already set...');
        const meta = require('./meta').default;
        const defaults = require(path_1.default.join(__dirname, '../', 'install/data/defaults.json'));
        yield meta.config.setOnEmpty(defaults);
        yield meta.config.init();
    });
}
function enableDefaultTheme() {
    return __awaiter(this, void 0, void 0, function* () {
        const meta = require('./meta').default;
        const id = yield meta.config.get('theme:id');
        if (id) {
            console.log('Previous theme detected, skipping enabling default theme');
            return;
        }
        const defaultTheme = nconf_1.default.get('defaultTheme') || 'nodebb-theme-persona';
        console.log(`Enabling default theme: ${defaultTheme}`);
        yield meta.themes.set({
            type: 'local',
            id: defaultTheme,
        });
    });
}
function createDefaultUserGroups() {
    return __awaiter(this, void 0, void 0, function* () {
        const groups = require('./groups').default;
        function createGroup(name) {
            return __awaiter(this, void 0, void 0, function* () {
                yield groups.create({
                    name: name,
                    hidden: 1,
                    private: 1,
                    system: 1,
                    disableLeave: 1,
                    disableJoinRequests: 1,
                });
            });
        }
        const [verifiedExists, unverifiedExists, bannedExists] = yield groups.exists([
            'verified-users', 'unverified-users', 'banned-users',
        ]);
        if (!verifiedExists) {
            yield createGroup('verified-users');
        }
        if (!unverifiedExists) {
            yield createGroup('unverified-users');
        }
        if (!bannedExists) {
            yield createGroup('banned-users');
        }
    });
}
function createAdministrator() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('GROUPS', groups_1.default);
        const memberCount = yield groups_1.default.getMemberCount('administrators');
        if (memberCount > 0) {
            console.log('Administrator found, skipping Admin setup');
            return;
        }
        return yield createAdmin();
    });
}
function createAdmin() {
    return __awaiter(this, void 0, void 0, function* () {
        const User = require('./user');
        const Groups = require('./groups');
        let password;
        winston_1.default.warn('No administrators have been detected, running initial user setup\n');
        let questions = [{
                name: 'username',
                description: 'Administrator username',
                required: true,
                type: 'string',
            }, {
                name: 'email',
                description: 'Administrator email address',
                pattern: /.+@.+/,
                required: true,
            }];
        const passwordQuestions = [{
                name: 'password',
                description: 'Password',
                required: true,
                hidden: true,
                type: 'string',
            }, {
                name: 'password:confirm',
                description: 'Confirm Password',
                required: true,
                hidden: true,
                type: 'string',
            }];
        function success(results) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!results) {
                    throw new Error('aborted');
                }
                if (results['password:confirm'] !== results.password) {
                    winston_1.default.warn('Passwords did not match, please try again');
                    return yield retryPassword(results);
                }
                try {
                    User.isPasswordValid(results.password);
                }
                catch (err) {
                    const [namespace, key] = err.message.slice(2, -2).split(':', 2);
                    if (namespace && key && err.message.startsWith('[[') && err.message.endsWith(']]')) {
                        const lang = require(path_1.default.join(__dirname, `../../public/language/en-GB/${namespace}`));
                        if (lang && lang[key]) {
                            err.message = lang[key];
                        }
                    }
                    winston_1.default.warn(`Password error, please try again. ${err.message}`);
                    return yield retryPassword(results);
                }
                const adminUid = yield User.create({
                    username: results.username,
                    password: results.password,
                    email: results.email,
                });
                yield Groups.join('administrators', adminUid);
                yield Groups.show('administrators');
                yield Groups.ownership.grant(adminUid, 'administrators');
                return password ? results : undefined;
            });
        }
        function retryPassword(originalResults) {
            return __awaiter(this, void 0, void 0, function* () {
                // Ask only the password questions
                const results = yield prompt.get(passwordQuestions);
                // Update the original data with newly collected password
                originalResults.password = results.password;
                originalResults['password:confirm'] = results['password:confirm'];
                // Send back to success to handle
                return yield success(originalResults);
            });
        }
        // Add the password questions
        questions = questions.concat(passwordQuestions);
        if (!install.values) {
            const results = yield prompt.get(questions);
            return yield success(results);
        }
        // If automated setup did not provide a user password, generate one,
        // it will be shown to the user upon setup completion
        if (!install.values.hasOwnProperty('admin:password') && !nconf_1.default.get('admin:password')) {
            console.log('Password was not provided during automated setup, generating one...');
            password = utils_1.default.generateUUID().slice(0, 8);
        }
        const results = {
            username: install.values['admin:username'] || nconf_1.default.get('admin:username') || 'admin',
            email: install.values['admin:email'] || nconf_1.default.get('admin:email') || '',
            password: install.values['admin:password'] || nconf_1.default.get('admin:password') || password,
            'password:confirm': install.values['admin:password:confirm'] || nconf_1.default.get('admin:password') || password,
        };
        return yield success(results);
    });
}
function createGlobalModeratorsGroup() {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield groups_1.default.exists('Global Moderators');
        if (exists) {
            winston_1.default.info('Global Moderators group found, skipping creation!');
        }
        else {
            yield groups_1.default.create({
                name: 'Global Moderators',
                userTitle: 'Global Moderator',
                description: 'Forum wide moderators',
                hidden: 0,
                private: 1,
                disableJoinRequests: 1,
            });
        }
        yield groups_1.default.show('Global Moderators');
    });
}
function giveGlobalPrivileges() {
    return __awaiter(this, void 0, void 0, function* () {
        const defaultPrivileges = [
            'groups:chat', 'groups:upload:post:image', 'groups:signature', 'groups:search:content',
            'groups:search:users', 'groups:search:tags', 'groups:view:users', 'groups:view:tags', 'groups:view:groups',
            'groups:local:login',
        ];
        console.log('PRIVILEGES', privileges_1.default);
        yield privileges_1.default.global.give(defaultPrivileges, 'registered-users');
        yield privileges_1.default.global.give(defaultPrivileges.concat([
            'groups:ban', 'groups:upload:post:file', 'groups:view:users:info',
        ]), 'Global Moderators');
        yield privileges_1.default.global.give(['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'guests');
        yield privileges_1.default.global.give(['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'spiders');
    });
}
function createCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        const Categories = require('./categories');
        const cids = yield database_1.primaryDB.default.getSortedSetRange('categories:cid', 0, -1);
        if (Array.isArray(cids) && cids.length) {
            console.log(`Categories OK. Found ${cids.length} categories.`);
            return;
        }
        console.log('No categories found, populating instance with default categories');
        const default_categories = JSON.parse(yield fs.promises.readFile(path_1.default.join(__dirname, '../', 'install/data/categories.json'), 'utf8'));
        for (const categoryData of default_categories) {
            // eslint-disable-next-line no-await-in-loop
            yield Categories.create(categoryData);
        }
    });
}
function createMenuItems() {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield database_1.primaryDB.default.exists('navigation:enabled');
        if (exists) {
            return;
        }
        const navigation = require('./navigation/admin');
        const data = require('../install/data/navigation.json');
        yield navigation.save(data);
    });
}
function createWelcomePost() {
    return __awaiter(this, void 0, void 0, function* () {
        const Topics = require('./topics');
        const [content, numTopics] = yield Promise.all([
            fs.promises.readFile(path_1.default.join(__dirname, '../', 'install/data/welcome.md'), 'utf8'),
            database_1.primaryDB.default.getObjectField('global', 'topicCount'),
        ]);
        if (!parseInt(numTopics, 10)) {
            console.log('Creating welcome post!');
            yield Topics.post({
                uid: 1,
                cid: 2,
                title: 'Welcome to your NodeBB!',
                content: content,
            });
        }
    });
}
function enableDefaultPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Enabling default plugins');
        let defaultEnabled = [
            'nodebb-plugin-composer-default',
            'nodebb-plugin-markdown',
            'nodebb-plugin-mentions',
            'nodebb-widget-essentials',
            'nodebb-rewards-essentials',
            'nodebb-plugin-emoji',
            'nodebb-plugin-emoji-android',
        ];
        let customDefaults = nconf_1.default.get('defaultplugins') || nconf_1.default.get('defaultPlugins');
        winston_1.default.info(`[install/defaultPlugins] customDefaults ${String(customDefaults)}`);
        if (customDefaults && customDefaults.length) {
            try {
                customDefaults = Array.isArray(customDefaults) ? customDefaults : JSON.parse(customDefaults);
                defaultEnabled = defaultEnabled.concat(customDefaults);
            }
            catch (e) {
                // Invalid value received
                winston_1.default.info('[install/enableDefaultPlugins] Invalid defaultPlugins value received. Ignoring.');
            }
        }
        defaultEnabled = _.uniq(defaultEnabled);
        winston_1.default.info('[install/enableDefaultPlugins] activating default plugins', defaultEnabled);
        const order = defaultEnabled.map((plugin, index) => index);
        yield database_1.primaryDB.default.sortedSetAdd('plugins:active', order, defaultEnabled);
    });
}
function setCopyrightWidget() {
    return __awaiter(this, void 0, void 0, function* () {
        const [footerJSON, footer] = yield Promise.all([
            fs.promises.readFile(path_1.default.join(__dirname, '../', 'install/data/footer.json'), 'utf8'),
            database_1.primaryDB.default.getObjectField('widgets:global', 'footer'),
        ]);
        if (!footer && footerJSON) {
            yield database_1.primaryDB.default.setObjectField('widgets:global', 'footer', footerJSON);
        }
    });
}
function copyFavicon() {
    return __awaiter(this, void 0, void 0, function* () {
        const pathToIco = path_1.default.join(nconf_1.default.get('upload_path'), 'system', 'favicon.ico');
        const defaultIco = path_1.default.join(nconf_1.default.get('base_dir'), 'public', 'favicon.ico');
        const targetExists = yield file_1.default.exists(pathToIco);
        const defaultExists = yield file_1.default.exists(defaultIco);
        if (defaultExists && !targetExists) {
            try {
                yield fs.promises.copyFile(defaultIco, pathToIco);
            }
            catch (err) {
                winston_1.default.error(`Cannot copy favicon.ico\n${err.stack}`);
            }
        }
    });
}
function checkUpgrade() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield upgrade_1.default.check();
        }
        catch (err) {
            if (err.message === 'schema-out-of-date') {
                yield upgrade_1.default.run();
                return;
            }
            throw err;
        }
    });
}
install.setup = function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            checkSetupFlagEnv();
            checkCIFlag();
            yield setupConfig();
            yield setupDefaultConfigs();
            yield enableDefaultTheme();
            yield createCategories();
            yield createDefaultUserGroups();
            const adminInfo = yield createAdministrator();
            yield createGlobalModeratorsGroup();
            yield giveGlobalPrivileges();
            yield createMenuItems();
            yield createWelcomePost();
            yield enableDefaultPlugins();
            yield setCopyrightWidget();
            yield copyFavicon();
            yield checkUpgrade();
            const data = Object.assign({}, adminInfo);
            return data;
        }
        catch (err) {
            if (err) {
                winston_1.default.warn(`NodeBB Setup Aborted.\n ${err.stack}`);
                process.exit(1);
            }
        }
    });
};
install.save = function (server_conf) {
    return __awaiter(this, void 0, void 0, function* () {
        let serverConfigPath = path_1.default.join(__dirname, '../config.json');
        if (nconf_1.default.get('config')) {
            serverConfigPath = path_1.default.resolve(__dirname, '../', nconf_1.default.get('config'));
        }
        let currentConfig = {};
        try {
            currentConfig = require(serverConfigPath);
        }
        catch (err) {
            if (err.code !== 'MODULE_NOT_FOUND') {
                throw err;
            }
        }
        yield fs.promises.writeFile(serverConfigPath, JSON.stringify(Object.assign(Object.assign({}, currentConfig), server_conf), null, 4));
        console.log('Configuration Saved OK');
        nconf_1.default.file({
            file: serverConfigPath,
        });
    });
};
exports.default = install;
