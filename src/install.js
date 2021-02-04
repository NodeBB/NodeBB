'use strict';

const fs = require('fs');
const url = require('url');
const path = require('path');
const prompt = require('prompt');
const winston = require('winston');
const nconf = require('nconf');
const _ = require('lodash');
const util = require('util');

const promptGet = util.promisify((schema, callback) => prompt.get(schema, callback));

const utils = require('./utils.js');

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

function checkSetupFlag() {
	let setupVal = install.values;

	try {
		if (nconf.get('setup')) {
			setupVal = JSON.parse(nconf.get('setup'));
		}
	} catch (err) {
		winston.error('Invalid json in nconf.get(\'setup\'), ignoring setup values');
	}

	if (setupVal && typeof setupVal === 'object') {
		if (setupVal['admin:username'] && setupVal['admin:password'] && setupVal['admin:password:confirm'] && setupVal['admin:email']) {
			install.values = setupVal;
		} else {
			winston.error('Required values are missing for automated setup:');
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
	var ciVals;
	try {
		ciVals = JSON.parse(nconf.get('ci'));
	} catch (e) {
		ciVals = undefined;
	}

	if (ciVals && ciVals instanceof Object) {
		if (ciVals.hasOwnProperty('host') && ciVals.hasOwnProperty('port') && ciVals.hasOwnProperty('database')) {
			install.ciVals = ciVals;
		} else {
			winston.error('Required values are missing for automated CI integration:');
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
		const allQuestions = questions.main.concat(questions.optional).concat(redisQuestions).concat(mongoQuestions).concat(postgresQuestions);

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
		config = await promptGet(questions.main);
	}
	await configureDatabases(config);
	await completeConfigSetup(config);
}

async function completeConfigSetup(config) {
	// Add CI object
	if (install.ciVals) {
		config.test_database = {};
		for (var prop in install.ciVals) {
			if (install.ciVals.hasOwnProperty(prop)) {
				config.test_database[prop] = install.ciVals[prop];
			}
		}
	}

	// Add package_manager object if set
	if (nconf.get('package_manager')) {
		config.package_manager = nconf.get('package_manager');
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
	var urlObj = url.parse(config.url);
	if (urlObj.port) {
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

	const defaultTheme = nconf.get('defaultTheme') || 'nodebb-theme-persona';
	console.log(`Enabling default theme: ${defaultTheme}`);
	await meta.themes.set({
		type: 'local',
		id: defaultTheme,
	});
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
		// Ask only the password questions
		const results = await promptGet(passwordQuestions);

		// Update the original data with newly collected password
		originalResults.password = results.password;
		originalResults['password:confirm'] = results['password:confirm'];

		// Send back to success to handle
		return await success(originalResults);
	}

	// Add the password questions
	questions = questions.concat(passwordQuestions);

	if (!install.values) {
		const results = await promptGet(questions);
		return await success(results);
	}
	// If automated setup did not provide a user password, generate one, it will be shown to the user upon setup completion
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
		'nodebb-widget-essentials',
		'nodebb-rewards-essentials',
		'nodebb-plugin-emoji',
		'nodebb-plugin-emoji-android',
	];
	let customDefaults = nconf.get('defaultplugins') || nconf.get('defaultPlugins');

	winston.info('[install/defaultPlugins] customDefaults', customDefaults);

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
		await db.setObjectField('widgets:global', 'footer', footerJSON);
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

install.setup = async function () {
	try {
		checkSetupFlag();
		checkCIFlag();
		await setupConfig();
		await setupDefaultConfigs();
		await enableDefaultTheme();
		await createCategories();
		const adminInfo = await createAdministrator();
		await createGlobalModeratorsGroup();
		await giveGlobalPrivileges();
		await createMenuItems();
		await createWelcomePost();
		await enableDefaultPlugins();
		await setCopyrightWidget();
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

	await fs.promises.writeFile(serverConfigPath, JSON.stringify(server_conf, null, 4));
	console.log('Configuration Saved OK');
	nconf.file({
		file: serverConfigPath,
	});
};
