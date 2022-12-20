'use strict';

import nconf from 'nconf';
import rdb from '../../database/redis';
import mdb from '../../database/mongo';
import pdb from '../../database/postgres';



const databaseController = {} as any;

databaseController.get = async function (req, res) {
	const results = {} as any;
	if (nconf.get('redis')) {
		results.redis = await rdb.info(rdb.client);
	}
	if (nconf.get('mongo')) {
		results.mongo = await mdb.info(mdb.client);
	}
	if (nconf.get('postgres')) {
		results.postgres = await pdb.info(pdb.pool);
	}

	res.render('admin/advanced/database', results);
};

export default databaseController;