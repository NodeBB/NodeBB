'use strict';

const nconf = require('nconf');
const db = require('../database');

module.exports.ping = async function (req, res, next) {
	try {
		await db.getObject('config');
		res.status(200).send(req.path === `${nconf.get('relative_path')}/sping` ? 'healthy' : '200');
	} catch (err) {
		next(err);
	}
};
