'use strict';

const prompt = require('prompt');
const winston = require('winston');

const questions = {
	redis: require('../src/database/redis').questions,
	mongo: require('../src/database/mongo').questions,
	postgres: require('../src/database/postgres').questions,
	mysql: require('../src/database/mysql').questions,
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
	} else if (config.database === 'mysql') {
		if ((config['mysql:host'] && config['mysql:port']) || config['mysql:socketPath']) {
			return config;
		}
		return await prompt.get(questions.mysql);
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
	} else if (config.database === 'mysql') {
		config.mysql = {
			host: databaseConfig['mysql:host'],
			port: databaseConfig['mysql:port'],
			socketPath: databaseConfig['mysql:socketPath'],
			username: databaseConfig['mysql:username'],
			password: databaseConfig['mysql:password'],
			database: databaseConfig['mysql:database'],
		};
	} else {
		throw new Error(`unknown database : ${config.database}`);
	}

	const allQuestions = questions.redis.concat(questions.mongo).concat(questions.postgres).concat(questions.mysql);
	for (let x = 0; x < allQuestions.length; x += 1) {
		delete config[allQuestions[x].name];
	}

	return config;
}
