'use strict';

import nconf from 'nconf';
import db from '../database';

export const ping = async function (req, res, next) {
	try {
		await db.getObject('config');
		res.status(200).send(req.path === `${nconf.get('relative_path')}/sping` ? 'healthy' : '200');
	} catch (err: any) {
		next(err);
	}
};
