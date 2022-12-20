'use strict';

import nconf from 'nconf';
import winston from 'winston';
import * as webserver from './webserver';
import sockets from './socket.io';
import db from './database';
import meta from './meta';
import upgrade from './upgrade';
import notifications from './notifications';
import plugins from './plugins';
import topics from './topics';
import user from './user';

const start = {} as any;

start.start = async function () {
	printStartupInfo();

	addProcessHandlers();

	try {

		await db.init();
		await db.checkCompatibility();
		await meta.configs.init();

		if (nconf.get('runJobs')) {
	       await runUpgrades();
		}

		if (nconf.get('dep-check') === undefined || nconf.get('dep-check') !== false) {
			await meta.dependencies.check();
		} else {
			winston.warn('[init] Dependency checking skipped!');
		}

		await db.initSessionStore();


		await sockets.init(webserver.server);

		if (nconf.get('runJobs')) {
			notifications.startJobs();
			user.startJobs();
			plugins.startJobs();
			topics.scheduled.startJobs();
			await db.delete('locks');
		}

		await webserver.listen();

		if ((process as any).send) {
			(process as any).send({
				action: 'listening',
			});
		}
	} catch (err: any) {
		switch (err.message) {
			case 'dependencies-out-of-date':
				winston.error('One or more of NodeBB\'s dependent packages are out-of-date. Please run the following command to update them:');
				winston.error('    ./nodebb upgrade');
				break;
			case 'dependencies-missing':
				winston.error('One or more of NodeBB\'s dependent packages are missing. Please run the following command to update them:');
				winston.error('    ./nodebb upgrade');
				break;
			default:
				winston.error(err.stack);
				break;
		}

		// Either way, bad stuff happened. Abort start.
		(process as any).exit();
	}
};

async function runUpgrades() {
	try {
		await upgrade.check();
	} catch (err: any) {
		if (err && err.message === 'schema-out-of-date') {
			await upgrade.run();
		} else {
			throw err;
		}
	}
}

function printStartupInfo() {
	if (nconf.get('isPrimary')) {
		winston.info('Initializing NodeBB v%s %s', nconf.get('version'), nconf.get('url'));

		const host = nconf.get(`${nconf.get('database')}:host`);
		const storeLocation = host ? `at ${host}${!host.includes('/') ? `:${nconf.get(`${nconf.get('database')}:port`)}` : ''}` : '';

		winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
		winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
	}
}

import benchpressjs from 'benchpressjs';
import translator from './translator';


function addProcessHandlers() {
	(process as any).on('SIGTERM', shutdown);
	(process as any).on('SIGINT', shutdown);
	(process as any).on('SIGHUP', restart);
	(process as any).on('uncaughtException', (err) => {
		winston.error(err.stack);

		require('./meta').js.killMinifier();
		shutdown(1);
	});
	(process as any).on('message', (msg) => {
		if (msg && Array.isArray(msg.compiling)) {
			if (msg.compiling.includes('tpl')) {
				benchpressjs.flush();
			} else if (msg.compiling.includes('lang')) {
				translator.flush();
			}
		}
	});
}

function restart() {
	if ((process as any).send) {
		winston.info('[app] Restarting...');
		(process as any).send({
			action: 'restart',
		});
	} else {
		winston.error('[app] Could not restart server. Shutting down.');
		shutdown(1);
	}
}

async function shutdown(code) {
	winston.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
	try {
		await require('./webserver').destroy();
		winston.info('[app] Web server closed to connections.');
		await require('./analytics').writeData();
		winston.info('[app] Live analytics saved.');
		await require('./database').close();
		winston.info('[app] Database connection closed.');
		winston.info('[app] Shutdown complete.');
		(process as any).exit(code || 0);
	} catch (err: any) {
		winston.error(err.stack);
		return (process as any).exit(code || 0);
	}
}

export default start;