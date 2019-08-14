'use strict';

const nconf = require('nconf');

const databaseController = module.exports;

databaseController.get = async function (req, res) {
	const results = {};
	try {
		if (nconf.get('redis')) {
			const rdb = require('../../database/redis');
			results.redis = await rdb.info(rdb.client);
		}
		if (nconf.get('mongo')) {
			const mdb = require('../../database/mongo');
			results.mongo = await mdb.info(mdb.client);
		}
		if (nconf.get('postgres')) {
			const pdb = require('../../database/postgres');
			results.postgres = await pdb.info(pdb.pool);
		}
	} catch (err) {
		Object.assign(results, { error: err });
		// Override mongo error with more human-readable error
		if (err.name === 'MongoError' && err.codeName === 'Unauthorized') {
			err.friendlyMessage = '[[admin/advanced/database:mongo.unauthorized]]';
			delete results.mongo;
		}
	}
	res.render('admin/advanced/database', results);
};
