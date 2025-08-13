'use strict';

const fs = require('fs');
const url = require('url');
const path = require('path');
const prompt = require('prompt');
const winston = require('winston');
const nconf = require('nconf');
const _ = require('lodash');

const utils = require('./utils');
const { paths } = require('./constants');

const install = module.exports;
const questions = {};

questions.main = [
	{
		name: 'url',
		description: 'URL used to access this NodeBB',
		default:
			nconf.get('url') || 'http://localhost:4567',
		pattern: /^http(?:s)?:\/\//,
		message: 'Base URL must begin with \'http://\' or \'https://\'',
	},
	{
		name: 'secret',
		description: 'Please enter a NodeBB secret',
		default: nconf.get('secret') || utils.generateUUID(),
	},
	{
		name: 'submitPluginUsage',
		description: 'Would you like to submit anonymous plugin usage to nbbpm?',
		default: 'yes',
	},
	{
		name: 'database',
		description: 'Which database to use',
		default: nconf.get('database') || 'mongo',
	},
];

questions.optional = [
	{
		name: 'port',
		default: nconf.get('port') || 4567,
	},
];

function checkSetupFlagEnv() {
	let setupVal = install.values;

	const envConfMap = {
		CONFIG: 'config',
		NODEBB_CONFIG: 'config',
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
		winston.info('[install/checkSetupFlagEnv] checking env vars for setup info...');
		setupVal = setupVal || {};

		Object.entries(process.env).forEach(([evName, evValue]) => { // get setup values from env
			if (evName.startsWith('NODEBB_DB_')) {
				setupVal[`${process.env.NODEBB_DB}:${envConfMap[evName]}`] = evValue;
			} else if (evName.startsWith('NODEBB_')) {
				setupVal[envConfMap[evName]] = evValue;
			}
		});

		setupVal['admin:password:confirm'] = setupVal['admin:password'];
	}

	// try to get setup values from json, if successful this overwrites all values set by env
	// TODO: better behaviour would be to support overrides per value, i.e. in order of priority (generic pattern):
	//       flag, env, config file, default
	try {
		if (nconf.get('setup')) {
			const setupJSON = JSON.parse(nconf.get('setup'));
			setupVal = { ...setupVal, ...setupJSON };
		}
	} catch (err) {
		winston.error('[install/checkSetupFlagEnv] invalid json in nconf.get(\'setup\'), ignoring setup values from json');
	}

	if (setupVal && typeof setupVal === 'object') {
		if (setupVal['admin:username'] && setupVal['admin:password'] && setupVal['admin:password:confirm'] && setupVal['admin:email']) {
			install.values = setupVal;
		} else {
			winston.error('[install/checkSetupFlagEnv] required values are missing for automated setup:');
			if (!setupVal['admin:username']) {
				winston.error('  admin:username');
			}
			if (!setupVal['admin:password']) {
				winston.error('  admin:password');
			}
			if (!setupVal['admin:password:confirm']) {
				winston.error('  admin:password:confirm');
			}
			if (!setupVal['admin:email']) {
				winston.error('  admin:email');
			}

			process.exit();
		}
	} else if (nconf.get('database')) {
		install.values = install.values || {};
		install.values.database = nconf.get('database');
	}
}

function checkCIFlag() {
	let ciVals;
	try {
		ciVals = JSON.parse(nconf.get('ci'));
	} catch (e) {
		ciVals = undefined;
	}

	if (ciVals && ciVals instanceof Object) {
		if (ciVals.hasOwnProperty('host') && ciVals.hasOwnProperty('port') && ciVals.hasOwnProperty('database')) {
			install.ciVals = ciVals;
		} else {
			winston.error('[install/checkCIFlag] required values are missing for automated CI integration:');
			if (!ciVals.hasOwnProperty('host')) {
				winston.error('  host');
			}
			if (!ciVals.hasOwnProperty('port')) {
				winston.error('  port');
			}
			if (!ciVals.hasOwnProperty('database')) {
				winston.error('  database');
			}

			process.exit();
		}
	}
}

async function setupConfig() {
	const configureDatabases = require('../install/databases');

	// prompt prepends "prompt: " to questions, let's clear that.
	prompt.start();
	prompt.message = '';
	prompt.delimiter = '';
	prompt.colors = false;
	let config = {};

	if (install.values) {
		// Use provided values, fall back to defaults
		const redisQuestions = require('./database/redis').questions;
		const mongoQuestions = require('./database/mongo').questions;
		const postgresQuestions = require('./database/postgres').questions;
		const mysqlQuestions = require('./database/mysql').questions;
		const allQuestions = [
			...questions.main,
			...questions.optional,
			...redisQuestions,
			...mongoQuestions,
			...postgresQuestions,
			...mysqlQuestions,
		];

		allQuestions.forEach((question) => {
			if (install.values.hasOwnProperty(question.name)) {
				config[question.name] = install.values[question.name];
			} else if (question.hasOwnProperty('default')) {
				config[question.name] = question.default;
			} else {
				config[question.name] = undefined;
			}
		});
	} else {
		config = await prompt.get(questions.main);
	}
	await configureDatabases(config);
	await completeConfigSetup(config);
}

async function completeConfigSetup(config) {
	// Add CI object
	if (install.ciVals) {
		config.test_database = { ...install.ciVals };
	}

	// Add package_manager object if set
	if (nconf.get('package_manager')) {
		config.package_manager = nconf.get('package_manager');
	}

	if (install.values && install.values.hasOwnProperty('saas_plan')) {
		config.saas_plan = install.values.saas_plan;
	}

	nconf.overrides(config);
	const db = require('./database');
	await db.init();
	if (db.hasOwnProperty('createIndices')) {
		await db.createIndices();
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

	const meta = require('./meta');
	await meta.configs.set('submitPluginUsage', config.submitPluginUsage === 'yes' ? 1 : 0);
	delete config.submitPluginUsage;

	await install.save(config);
}

async function setupDefaultConfigs() {
	console.log('Populating database with default configs, if not already set...');
	const meta = require('./meta');
	const defaults = require(path.join(__dirname, '../', 'install/data/defaults.json'));

	await meta.configs.setOnEmpty(defaults);
	await meta.configs.init();
}

async function enableDefaultTheme() {
	const meta = require('./meta');

	const id = await meta.configs.get('theme:id');
	if (id) {
		console.log('Previous theme detected, skipping enabling default theme');
		return;
	}

	const defaultTheme = nconf.get('defaultTheme') || 'nodebb-theme-harmony';
	console.log(`Enabling default theme: ${defaultTheme}`);
	await meta.themes.set({
		type: 'local',
		id: defaultTheme,
	});
}

async function createDefaultUserGroups() {
	const groups = require('./groups');
	async function createGroup(name) {
		await groups.create({
			name: name,
			hidden: 1,
			private: 1,
			system: 1,
			disableLeave: 1,
			disableJoinRequests: 1,
		});
	}

	const [verifiedExists, unverifiedExists, bannedExists] = await groups.exists([
		'verified-users', 'unverified-users', 'banned-users',
	]);
	if (!verifiedExists) {
		await createGroup('verified-users');
	}

	if (!unverifiedExists) {
		await createGroup('unverified-users');
	}

	if (!bannedExists) {
		await createGroup('banned-users');
	}
}

async function createAdministrator() {
	const Groups = require('./groups');
	const memberCount = await Groups.getMemberCount('administrators');
	if (memberCount > 0) {
		console.log('Administrator found, skipping Admin setup');
		return;
	}
	return await createAdmin();
}

async function createAdmin() {
	const User = require('./user');
	const Groups = require('./groups');
	let password;

	winston.warn('No administrators have been detected, running initial user setup\n');

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

	async function success(results) {
		if (!results) {
			throw new Error('aborted');
		}

		if (results['password:confirm'] !== results.password) {
			winston.warn('Passwords did not match, please try again');
			return await retryPassword(results);
		}

		try {
			User.isPasswordValid(results.password);
		} catch (err) {
			const [namespace, key] = err.message.slice(2, -2).split(':', 2);
			if (namespace && key && err.message.startsWith('[[') && err.message.endsWith(']]')) {
				const lang = require(path.join(__dirname, `../public/language/en-GB/${namespace}`));
				if (lang && lang[key]) {
					err.message = lang[key];
				}
			}

			winston.warn(`Password error, please try again. ${err.message}`);
			return await retryPassword(results);
		}

		const adminUid = await User.create({
			username: results.username,
			password: results.password,
			email: results.email,
		});
		await Groups.join('administrators', adminUid);
		await Groups.show('administrators');
		await Groups.ownership.grant(adminUid, 'administrators');

		return password ? results : undefined;
	}

	async function retryPassword(originalResults) {
		const results = await prompt.get(passwordQuestions);

		originalResults.password = results.password;
		originalResults['password:confirm'] = results['password:confirm'];

		return await success(originalResults);
	}

	questions = questions.concat(passwordQuestions);

	if (!install.values) {
		const results = await prompt.get(questions);
		return await success(results);
	}

	if (!install.values.hasOwnProperty('admin:password') && !nconf.get('admin:password')) {
		console.log('Password was not provided during automated setup, generating one...');
		password = utils.generateUUID().slice(0, 8);
	}

	const results = {
		username: install.values['admin:username'] || nconf.get('admin:username') || 'admin',
		email: install.values['admin:email'] || nconf.get('admin:email') || '',
		password: install.values['admin:password'] || nconf.get('admin:password') || password,
		'password:confirm': install.values['admin:password:confirm'] || nconf.get('admin:password') || password,
	};

	return await success(results);
}

async function createGlobalModeratorsGroup() {
	const groups = require('./groups');
	const exists = await groups.exists('Global Moderators');
	if (exists) {
		winston.info('Global Moderators group found, skipping creation!');
	} else {
		await groups.create({
			name: 'Global Moderators',
			userTitle: 'Global Moderator',
			description: 'Forum wide moderators',
			hidden: 0,
			private: 1,
			disableJoinRequests: 1,
		});
	}
	await groups.show('Global Moderators');
}

async function giveGlobalPrivileges() {
	const privileges = require('./privileges');
	const defaultPrivileges = [
		'groups:chat', 'groups:upload:post:image', 'groups:signature', 'groups:search:content',
		'groups:search:users', 'groups:search:tags', 'groups:view:users', 'groups:view:tags', 'groups:view:groups',
		'groups:local:login',
	];
	await privileges.global.give(defaultPrivileges, 'registered-users');
	await privileges.global.give(defaultPrivileges.concat([
		'groups:ban', 'groups:upload:post:file', 'groups:view:users:info',
	]), 'Global Moderators');
	await privileges.global.give(['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'guests');
	await privileges.global.give(['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'spiders');
	await privileges.global.give(['groups:view:users'], 'fediverse');
}

async function giveWorldPrivileges() {
	// should match privilege assignment logic in src/categories/create.js EXCEPT commented one liner below
	const privileges = require('./privileges');
	const defaultPrivileges = [
		'groups:find',
		'groups:read',
		'groups:topics:read',
		'groups:topics:create',
		'groups:topics:reply',
		'groups:topics:tag',
		'groups:posts:edit',
		'groups:posts:history',
		'groups:posts:delete',
		'groups:posts:upvote',
		'groups:posts:downvote',
		'groups:topics:delete',
	];
	const modPrivileges = defaultPrivileges.concat([
		'groups:topics:schedule',
		'groups:posts:view_deleted',
		'groups:purge',
	]);
	const guestPrivileges = ['groups:find', 'groups:read', 'groups:topics:read'];

	await privileges.categories.give(defaultPrivileges, -1, ['registered-users']);
	await privileges.categories.give(defaultPrivileges.slice(2), -1, ['fediverse']); // different priv set for fediverse
	await privileges.categories.give(modPrivileges, -1, ['administrators', 'Global Moderators']);
	await privileges.categories.give(guestPrivileges, -1, ['guests', 'spiders']);
}

async function createCategories() {
	const Categories = require('./categories');
	const db = require('./database');
	const cids = await db.getSortedSetRange('categories:cid', 0, -1);
	if (Array.isArray(cids) && cids.length) {
		console.log(`Categories OK. Found ${cids.length} categories.`);
		return;
	}

	console.log('No categories found, populating instance with default categories');

	const default_categories = JSON.parse(
		await fs.promises.readFile(path.join(__dirname, '../', 'install/data/categories.json'), 'utf8')
	);
	for (const categoryData of default_categories) {
		// eslint-disable-next-line no-await-in-loop
		await Categories.create(categoryData);
	}
}

async function createMenuItems() {
	const db = require('./database');

	const exists = await db.exists('navigation:enabled');
	if (exists) {
		return;
	}
	const navigation = require('./navigation/admin');
	const data = require('../install/data/navigation.json');
	await navigation.save(data);
}

async function createWelcomePost() {
	const db = require('./database');
	const Topics = require('./topics');

	const [content, numTopics] = await Promise.all([
		fs.promises.readFile(path.join(__dirname, '../', 'install/data/welcome.md'), 'utf8'),
		db.getObjectField('global', 'topicCount'),
	]);

	if (!parseInt(numTopics, 10)) {
		console.log('Creating welcome post!');
		await Topics.post({
			uid: 1,
			cid: 2,
			title: 'Welcome to your NodeBB!',
			content: content,
		});
	}
}

async function enableDefaultPlugins() {
	console.log('Enabling default plugins');

	let defaultEnabled = [
		'nodebb-plugin-composer-default',
		'nodebb-plugin-markdown',
		'nodebb-plugin-mentions',
		'nodebb-plugin-web-push',
		'nodebb-widget-essentials',
		'nodebb-rewards-essentials',
		'nodebb-plugin-emoji',
		'nodebb-plugin-emoji-android',
	];
	let customDefaults = nconf.get('defaultplugins') || nconf.get('defaultPlugins');

	winston.info(`[install/defaultPlugins] customDefaults ${String(customDefaults)}`);

	if (customDefaults && customDefaults.length) {
		try {
			customDefaults = Array.isArray(customDefaults) ? customDefaults : JSON.parse(customDefaults);
			defaultEnabled = defaultEnabled.concat(customDefaults);
		} catch (e) {
			// Invalid value received
			winston.info('[install/enableDefaultPlugins] Invalid defaultPlugins value received. Ignoring.');
		}
	}

	defaultEnabled = _.uniq(defaultEnabled);

	winston.info('[install/enableDefaultPlugins] activating default plugins', defaultEnabled);

	const db = require('./database');
	const order = defaultEnabled.map((plugin, index) => index);
	await db.sortedSetAdd('plugins:active', order, defaultEnabled);
}

async function setCopyrightWidget() {
	const db = require('./database');
	const [footerJSON, footer] = await Promise.all([
		fs.promises.readFile(path.join(__dirname, '../', 'install/data/footer.json'), 'utf8'),
		db.getObjectField('widgets:global', 'footer'),
	]);

	if (!footer && footerJSON) {
		await db.setObjectField('widgets:global', 'sidebar-footer', footerJSON);
	}
}

async function copyFavicon() {
	const file = require('./file');
	const pathToIco = path.join(nconf.get('upload_path'), 'system', 'favicon.ico');
	const defaultIco = path.join(nconf.get('base_dir'), 'public', 'favicon.ico');
	const targetExists = await file.exists(pathToIco);
	const defaultExists = await file.exists(defaultIco);

	if (defaultExists && !targetExists) {
		try {
			await fs.promises.copyFile(defaultIco, pathToIco);
		} catch (err) {
			winston.error(`Cannot copy favicon.ico\n${err.stack}`);
		}
	}
}

async function checkUpgrade() {
	const upgrade = require('./upgrade');
	try {
		await upgrade.check();
	} catch (err) {
		if (err.message === 'schema-out-of-date') {
			await upgrade.run();
			return;
		}
		throw err;
	}
}

async function installPlugins() {
	const pluginInstall = require('./plugins');
	const nbbVersion = require(paths.currentPackage).version;
	await Promise.all((await pluginInstall.getActive()).map(async (id) => {
		if (await pluginInstall.isInstalled(id)) return;
		const version = await pluginInstall.suggest(id, nbbVersion);
		await pluginInstall.toggleInstall(id, version.version);
	}));
}

install.setup = async function () {
	try {
		checkSetupFlagEnv();
		checkCIFlag();
		await setupConfig();
		await setupDefaultConfigs();
		await enableDefaultTheme();
		await createCategories();
		await createDefaultUserGroups();
		const adminInfo = await createAdministrator();
		await createGlobalModeratorsGroup();
		await giveGlobalPrivileges();
		await giveWorldPrivileges();
		await createMenuItems();
		await createWelcomePost();
		await enableDefaultPlugins();
		await setCopyrightWidget();
		await copyFavicon();
		if (nconf.get('plugins:autoinstall')) await installPlugins();
		await checkUpgrade();

		const data = {
			...adminInfo,
		};
		return data;
	} catch (err) {
		if (err) {
			winston.warn(`NodeBB Setup Aborted.\n ${err.stack}`);
			process.exit(1);
		}
	}
};

install.save = async function (server_conf) {
	let serverConfigPath = path.join(__dirname, '../config.json');

	if (nconf.get('config')) {
		serverConfigPath = path.resolve(__dirname, '../', nconf.get('config'));
	}

	let currentConfig = {};
	try {
		currentConfig = require(serverConfigPath);
	} catch (err) {
		if (err.code !== 'MODULE_NOT_FOUND') {
			throw err;
		}
	}

	await fs.promises.writeFile(serverConfigPath, JSON.stringify({
		...currentConfig,
		...server_conf,
	}, null, 4));
	console.log('Configuration Saved OK');
	nconf.file({
		file: serverConfigPath,
	});
};

install.giveWorldPrivileges = giveWorldPrivileges; // exported for upgrade script and test runner
