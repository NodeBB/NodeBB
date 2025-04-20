'use strict';

/**
 * Database Mock - wrapper for database.js, makes system use separate test db, instead of production
 * ATTENTION: testing db is flushed before every use!
 */

import '../../require-main.js';
import '../cleanup.mjs';

import nconf from 'nconf';
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import url, { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_ENV = process.env.TEST_ENV || 'production';
global.env = process.env.NODE_ENV || 'production';


import winston from 'winston';
import packageInfo from '../../package.json' with { type: 'json' };

winston.add(new winston.transports.Console({
	format: winston.format.combine(
		winston.format.splat(),
		winston.format.simple()
	),
}));

try {
	const configJSON = readFileSync(path.join(__dirname, '../../config.json'), 'utf-8');
	winston.info('configJSON');
	winston.info(configJSON);
} catch (err) {
	console.error(err.stack);
	throw err;
}

nconf.file({ file: path.join(__dirname, '../../config.json') });
nconf.defaults({
	base_dir: path.join(__dirname, '../..'),
	themes_path: path.join(__dirname, '../../node_modules'),
	upload_path: 'test/uploads',
	views_dir: path.join(__dirname, '../../build/public/templates'),
	relative_path: '',
});

const urlObject = url.parse(nconf.get('url'));
const relativePath = urlObject.pathname !== '/' ? urlObject.pathname : '';
nconf.set('relative_path', relativePath);
nconf.set('asset_base_url', `${relativePath}/assets`);
nconf.set('upload_path', path.join(nconf.get('base_dir'), nconf.get('upload_path')));
nconf.set('upload_url', '/assets/uploads');
nconf.set('url_parsed', urlObject);
nconf.set('base_url', `${urlObject.protocol}//${urlObject.host}`);
nconf.set('secure', urlObject.protocol === 'https:');
nconf.set('use_port', !!urlObject.port);
nconf.set('port', urlObject.port || nconf.get('port') || (nconf.get('PORT_ENV_VAR') ? nconf.get(nconf.get('PORT_ENV_VAR')) : false) || 4567);

// cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
const domain = nconf.get('cookieDomain') || urlObject.hostname;
const origins = nconf.get('socket.io:origins') || `${urlObject.protocol}//${domain}:*`;
nconf.set('socket.io:origins', origins);

if (nconf.get('isCluster') === undefined) {
	nconf.set('isPrimary', true);
	nconf.set('isCluster', false);
	nconf.set('singleHostCluster', false);
}

const dbType = nconf.get('database');
const testDbConfig = nconf.get('test_database');
const productionDbConfig = nconf.get(dbType);

if (!testDbConfig) {
	const errorText = 'test_database is not defined';
	winston.info(
		'\n===========================================================\n' +
		'Please, add parameters for test database in config.json\n' +
		'For example (redis):\n' +
		'"test_database": {\n' +
		'    "host": "127.0.0.1",\n' +
		'    "port": "6379",\n' +
		'    "password": "",\n' +
		'    "database": "1"\n' +
		'}\n' +
		' or (mongo):\n' +
		'"test_database": {\n' +
		'    "host": "127.0.0.1",\n' +
		'    "port": "27017",\n' +
		'    "password": "",\n' +
		'    "database": "1"\n' +
		'}\n' +
		' or (mongo) in a replicaset\n' +
		'"test_database": {\n' +
		'    "host": "127.0.0.1,127.0.0.1,127.0.0.1",\n' +
		'    "port": "27017,27018,27019",\n' +
		'    "username": "",\n' +
		'    "password": "",\n' +
		'    "database": "nodebb_test"\n' +
		'}\n' +
		' or (postgres):\n' +
		'"test_database": {\n' +
		'    "host": "127.0.0.1",\n' +
		'    "port": "5432",\n' +
		'    "username": "postgres",\n' +
		'    "password": "",\n' +
		'    "database": "nodebb_test"\n' +
		'}\n' +
		'==========================================================='
	);
	winston.error(errorText);
	throw new Error(errorText);
}

if (testDbConfig.database === productionDbConfig.database &&
	testDbConfig.host === productionDbConfig.host &&
	testDbConfig.port === productionDbConfig.port) {
	const errorText = 'test_database has the same config as production db';
	winston.error(errorText);
	throw new Error(errorText);
}

nconf.set(dbType, testDbConfig);

winston.info('database config %s', dbType, testDbConfig);
winston.info(`environment ${global.env}`);

nconf.set('core_templates_path', path.join(__dirname, '../../src/views'));
nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-persona/templates'));
nconf.set('theme_config', path.join(nconf.get('themes_path'), 'nodebb-theme-persona', 'theme.json'));
nconf.set('bcrypt_rounds', 1);
nconf.set('socket.io:origins', '*:*');
nconf.set('version', packageInfo.version);
nconf.set('runJobs', false);
nconf.set('jobsDisabled', false);
nconf.set('acpPluginInstallDisabled', false);

const db = (await import('../../src/database/index.js')).default;

await db.init();
if (db.hasOwnProperty('createIndices')) {
	await db.createIndices();
}
await setupMockDefaults();
await db.initSessionStore();

const meta = (await import('../../src/meta/index.js')).default;
nconf.set('theme_templates_path', meta.config['theme:templates'] ? path.join(nconf.get('themes_path'), meta.config['theme:id'], meta.config['theme:templates']) : nconf.get('base_templates_path'));
// nconf defaults, if not set in config
if (!nconf.get('sessionKey')) {
	nconf.set('sessionKey', 'express.sid');
}

await meta.dependencies.check();

const webserver = (await import('../../src/webserver.js')).default;
const sockets = (await import('../../src/socket.io/index.js')).default;
await sockets.init(webserver.server);

(await import('../../src/notifications.js')).default.startJobs();
(await import('../../src/user/index.js')).default.startJobs();

await webserver.listen();

before(async function () {
	// Iterate over all of the test suites/contexts
	this.test.parent.suites.forEach((suite) => {
		// Attach an afterAll listener that resets the defaults
		suite.afterAll(async () => {
			await setupMockDefaults();
		});
	});
});

async function setupMockDefaults() {
	const meta = (await import('../../src/meta/index.js')).default;
	await db.emptydb();

	winston.info('test_database flushed');
	await setupDefaultConfigs(meta);

	await meta.configs.init();
	meta.config.postDelay = 0;
	meta.config.initialPostDelay = 0;
	meta.config.newbiePostDelay = 0;
	meta.config.autoDetectLang = 0;

	(await import('../../src/groups/index.js')).default.cache.reset();
	(await import('../../src/posts/cache.js')).default.getOrCreate().reset();
	(await import('../../src/cache.js')).default.reset();
	(await import('../../src/middleware/uploads.js')).default.clearCache();
	// privileges must be given after cache reset
	await giveDefaultGlobalPrivileges();
	await enableDefaultPlugins();

	await meta.themes.set({
		type: 'local',
		id: 'nodebb-theme-persona',
	});

	const fs = await import('fs');
	await fs.promises.rm('test/uploads', { recursive: true, force: true });


	const { mkdirp } = await import('mkdirp');

	const folders = [
		'test/uploads',
		'test/uploads/category',
		'test/uploads/files',
		'test/uploads/system',
		'test/uploads/profile',
	];
	for (const folder of folders) {
		/* eslint-disable no-await-in-loop */
		await mkdirp(folder);
	}
}
db.setupMockDefaults = setupMockDefaults;

async function setupDefaultConfigs(meta) {
	winston.info('Populating database with default configs, if not already set...\n');

	const defaults = (await import(path.join(nconf.get('base_dir'), 'install/data/defaults.json'), { with: { type: 'json' } })).default;
	defaults.eventLoopCheckEnabled = 0;
	defaults.minimumPasswordStrength = 0;
	await meta.configs.setOnEmpty(defaults);
}

async function giveDefaultGlobalPrivileges() {
	winston.info('Giving default global privileges...\n');
	const privileges = (await import('../../src/privileges/index.js')).default;
	await privileges.global.give([
		'groups:chat', 'groups:upload:post:image', 'groups:signature', 'groups:search:content',
		'groups:search:users', 'groups:search:tags', 'groups:local:login', 'groups:view:users',
		'groups:view:tags', 'groups:view:groups',
	], 'registered-users');
	await privileges.global.give([
		'groups:view:users', 'groups:view:tags', 'groups:view:groups',
	], 'guests');
	await privileges.global.give(['groups:view:users'], 'fediverse');
}

async function enableDefaultPlugins() {
	winston.info('Enabling default plugins\n');
	const testPlugins = Array.isArray(nconf.get('test_plugins')) ? nconf.get('test_plugins') : [];
	const defaultEnabled = [
		'nodebb-plugin-dbsearch',
		'nodebb-widget-essentials',
		'nodebb-plugin-composer-default',
	].concat(testPlugins);

	winston.info('[install/enableDefaultPlugins] activating default plugins', defaultEnabled);

	await db.sortedSetAdd('plugins:active', Object.keys(defaultEnabled), defaultEnabled);
}

export default db;