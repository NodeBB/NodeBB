'use strict';

import winston from 'winston';
import path from 'path';import nconf from 'nconf';
import { build, buildAll } from '../meta/build';

const { default: { install } } = require('../../install/web');

export async function setup(initConfig) {
	const { paths } = require('../constants');
	const install = require('../install').default;

	const prestart = require('../prestart');
	const pkg = require('../../../package.json');

	winston.info('NodeBB Setup Triggered via Command Line');

	console.log(`\nWelcome to NodeBB v${pkg.version}!`);
	console.log('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
	console.log('Press enter to accept the default setting (shown in brackets).');

	install.values = initConfig;
	const data = await install.setup();
	let configFile = paths.config;
	if (nconf.get('config')) {
		configFile = path.resolve(paths.baseDir, nconf.get('config'));
	}

	prestart.loadConfig(configFile);

	if (!nconf.get('skip-build')) {
		await buildAll();
	}

	let separator = '     ';
	if ((process as any).stdout.columns > 10) {
		for (let x = 0, cols = (process as any).stdout.columns - 10; x < cols; x += 1) {
			separator += '=';
		}
	}
	console.log(`\n${separator}\n`);

	if (data.hasOwnProperty('password')) {
		console.log('An administrative user was automatically created for you:');
		console.log(`    Username: ${data.username}`);
		console.log(`    Password: ${data.password}`);
		console.log('');
	}
	console.log('NodeBB Setup Completed. Run "./nodebb start" to manually start your NodeBB server.');

	// If I am a child process, notify the parent of the returned data before exiting (useful for notifying
	// hosts of auto-generated username/password during headless setups)
	if ((process as any).send) {
		(process as any).send(data);
	}
	(process as any).exit();
}

export const webInstall = install;
