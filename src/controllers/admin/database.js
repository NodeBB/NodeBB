'use strict';

var async = require('async');
var nconf = require('nconf');

var databaseController = module.exports;

databaseController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				redis: function (next) {
					if (nconf.get('redis')) {
						var rdb = require('../../database/redis');
						rdb.info(rdb.client, next);
					} else {
						next();
					}
				},
				mongo: function (next) {
					if (nconf.get('mongo')) {
						var mdb = require('../../database/mongo');
						mdb.info(mdb.client, next);
					} else {
						next();
					}
				},
				postgres: function (next) {
					if (nconf.get('postgres')) {
						var pdb = require('../../database/postgres');
						pdb.info(pdb.pool, next);
					} else {
						next();
					}
				},
			}, next);
		},
		function (results) {
			res.render('admin/advanced/database', results);
		},
	], next);
};
