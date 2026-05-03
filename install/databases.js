'use strict';

const prompt = require('prompt');
const winston = require('winston');

const questions = {
	redis: require('../src/database/redis').questions,
	mongo: require('../src/database/mongo').questions,
	postgres: require('../src/database/postgres').questions,
	kysely: require('../src/database/kysely').questions,
};

module.exports = async function (config) {
	winston.info(`\nNow configuring ${config.database} database:`);
	const databaseConfig = await getDatabaseConfig(config);
	return saveDatabaseConfig(config, databaseConfig);
};

async function getDatabaseConfig(config) {
	if (!config) {
		throw new Error('invalid config, aborted');
	}

	if (config.database === 'redis') {
		if (config['redis:host'] && config['redis:port']) {
			return config;
		}
		return await prompt.get(questions.redis);
	} else if (config.database === 'mongo') {
		if ((config['mongo:host'] && config['mongo:port']) || config['mongo:uri']) {
			return config;
		}
		return await prompt.get(questions.mongo);
	} else if (config.database === 'postgres') {
		if (config['postgres:host'] && config['postgres:port']) {
			return config;
		}
		return await prompt.get(questions.postgres);
	} else if (config.database === 'kysely') {
		// Headless gate per dialect: dialect alone isn't enough for mysql/postgres,
		// where the host can't be inferred. sqlite/pglite only need a filename/path.
		const dialect = config['kysely:dialect'];
		const ready = dialect === 'sqlite' || dialect === 'pglite' ?
			Boolean(dialect) :
			Boolean(dialect && config['kysely:host'] && config['kysely:database']);
		if (ready) {
			return config;
		}
		return await prompt.get(questions.kysely);
	}
	throw new Error(`unknown database : ${config.database}`);
}

function saveDatabaseConfig(config, databaseConfig) {
	if (!databaseConfig) {
		throw new Error('invalid config, aborted');
	}

	// Translate redis properties into redis object
	if (config.database === 'redis') {
		config.redis = {
			host: databaseConfig['redis:host'],
			port: databaseConfig['redis:port'],
			password: databaseConfig['redis:password'],
			database: databaseConfig['redis:database'],
		};

		if (config.redis.host.slice(0, 1) === '/') {
			delete config.redis.port;
		}
	} else if (config.database === 'mongo') {
		config.mongo = {
			host: databaseConfig['mongo:host'],
			port: databaseConfig['mongo:port'],
			username: databaseConfig['mongo:username'],
			password: databaseConfig['mongo:password'],
			database: databaseConfig['mongo:database'],
			uri: databaseConfig['mongo:uri'],
		};
	} else if (config.database === 'postgres') {
		config.postgres = {
			host: databaseConfig['postgres:host'],
			port: databaseConfig['postgres:port'],
			username: databaseConfig['postgres:username'],
			password: databaseConfig['postgres:password'],
			database: databaseConfig['postgres:database'],
			ssl: databaseConfig['postgres:ssl'],
		};
	} else if (config.database === 'kysely') {
		// Persist only fields that apply to the chosen dialect — sqlite/pglite
		// have no host/port/username/password, so don't pollute saved config
		// with stale prompt defaults like 127.0.0.1:3306.
		const dialect = databaseConfig['kysely:dialect'];
		const ky = { dialect, database: databaseConfig['kysely:database'] };
		if (dialect !== 'sqlite' && dialect !== 'pglite') {
			ky.host = databaseConfig['kysely:host'];
			ky.port = databaseConfig['kysely:port'];
			ky.username = databaseConfig['kysely:username'];
			ky.password = databaseConfig['kysely:password'];
		}
		config.kysely = ky;
	} else {
		throw new Error(`unknown database : ${config.database}`);
	}

	const allQuestions = questions.redis.concat(questions.mongo).concat(questions.postgres).concat(questions.kysely);
	for (let x = 0; x < allQuestions.length; x += 1) {
		delete config[allQuestions[x].name];
	}

	return config;
}
