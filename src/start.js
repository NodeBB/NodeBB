'use strict';

const nconf = require('nconf');
const winston = require('winston');

const start = module.exports;

start.start = async function () {
	printStartupInfo();

	addProcessHandlers();

	try {
		const db = require('./database');
		await db.init();
		await db.checkCompatibility();

		const meta = require('./meta');
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

		const webserver = require('./webserver');
		const sockets = require('./socket.io');
		await sockets.init(webserver.server);

		if (nconf.get('runJobs')) {
			require('./notifications').startJobs();
			require('./user').startJobs();
			require('./plugins').startJobs();
			require('./topics').scheduled.startJobs();
			await db.delete('locks');
		}

		await webserver.listen();

		if (process.send) {
			process.send({
				action: 'listening',
			});
		}
	} catch (err) {
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
		process.exit();
	}
};

async function runUpgrades() {
	const upgrade = require('./upgrade');
	try {
		await upgrade.check();
	} catch (err) {
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

function addProcessHandlers() {
	['SIGTERM', 'SIGINT', 'SIGQUIT'].forEach((signal) => {
		process.on(signal, () => shutdown());
	});
	process.on('SIGHUP', restart);
	process.on('uncaughtException', (err) => {
		winston.error(err.stack);

		require('./meta').js.killMinifier();
		shutdown(1);
	});
	process.on('message', (msg) => {
		if (msg && Array.isArray(msg.compiling)) {
			if (msg.compiling.includes('tpl')) {
				const benchpressjs = require('benchpressjs');
				benchpressjs.flush();
			} else if (msg.compiling.includes('lang')) {
				const translator = require('./translator');
				translator.flush();
			}
		}
	});
}

function restart() {
	if (process.send) {
		winston.info('[app] Restarting...');
		process.send({
			action: 'restart',
		});
	} else {
		winston.error('[app] Could not restart server. Shutting down.');
		shutdown(1);
	}
}

async function shutdown(code) {
	winston.info('[app] Shutdown (SIGTERM/SIGINT/SIGQUIT) Initialised.');
	try {
		await require('./webserver').destroy();
		winston.info('[app] Web server closed to connections.');
		await require('./analytics').writeData();
		winston.info('[app] Live analytics saved.');
		const db = require('./database');
		await db.delete('locks');
		await db.close();
		winston.info('[app] Database connection closed.');
		winston.info('[app] Shutdown complete.');
		process.exit(code || 0);
	} catch (err) {
		winston.error(err.stack);

		return process.exit(code || 0);
	}
}
