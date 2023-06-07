'use strict';

const prompt = require('prompt');
const winston = require('winston');

const questions = {
	redis: require('../src/database/redis').questions,
	mongo: require('../src/database/mongo').questions,
	postgres: require('../src/database/postgres').questions,
	tigris: require('../src/database/tigris').questions,
	tigriscomp: require('../src/database/tigriscomp').questions,
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
	} else if (config.database === 'tigris') {
		if ((config['tigris:host'] && config['tigris:port'])) {
			return config;
		}
		return await prompt.get(questions.tigris);
	} else if (config.database === 'tigriscomp') {
		if ((config['tigriscomp:host'] && config['tigriscomp:port']) || config['tigriscomp:uri']) {
			return config;
		}
		return await prompt.get(questions.tigriscomp);
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
	} else if (config.database === 'tigris') {
		config.tigris = {
			host: databaseConfig['tigris:host'],
			port: databaseConfig['tigris:port'],
			clientid: databaseConfig['tigris:clientid'],
			clientsecret: databaseConfig['tigris:clientsecret'],
			database: databaseConfig['tigris:database'],
			uri: databaseConfig['tigris:uri'],
		};
	} else if (config.database === 'tigriscomp') {
		config.tigriscomp = {
			host: databaseConfig['tigriscomp:host'],
			port: databaseConfig['tigriscomp:port'],
			clientid: databaseConfig['tigriscomp:clientid'],
			clientsecret: databaseConfig['tigriscomp:clientsecret'],
			database: databaseConfig['tigriscomp:database'],
			uri: databaseConfig['tigriscomp:uri'],
		};
	} else {
		throw new Error(`unknown database : ${config.database}`);
	}

	const allQuestions = questions.redis.concat(questions.mongo).concat(questions.postgres)
		.concat(questions.tigriscomp).concat(questions.tigris);
	for (let x = 0; x < allQuestions.length; x += 1) {
		delete config[allQuestions[x].name];
	}

	return config;
}
