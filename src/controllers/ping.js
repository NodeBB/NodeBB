'use strict';

const async = require('async');
const nconf = require('nconf');
const db = require('../database');

module.exports.ping = function (req, res, next) {
	async.waterfall([
		function (next) {
			db.getObject('config', next);
		},
		function () {
			res.status(200).send(req.path === nconf.get('relative_path') + '/sping' ? 'healthy' : '200');
		},
	], next);
};
