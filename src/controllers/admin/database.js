'use strict';

var async = require('async');
var nconf = require('nconf');

var databaseController = {};



databaseController.get = function(req, res, next) {
	async.parallel({
		redis: function(next) {
			if (nconf.get('redis')) {
				var rdb = require('../../database/redis');
				// var cxn = rdb.connect();
				// Do not create new client if it exist.
				// This will cause memory leak & connection flood
				var cxn = rdb.client;
				// Redis was initalized.
				// Check cxn is unnecessary.
				// if (!cxn) {
				// 	cxn = rdb.client;
				// 	rdb.client = cxn;
				// }

				rdb.info(cxn, next);
			} else {
				next();
			}
		},
		mongo: function(next) {
			if (nconf.get('mongo')) {
				var mdb = require('../../database/mongo');
				mdb.info(mdb.client, next);
			} else {
				next();
			}
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		res.render('admin/advanced/database', results);
	});
};

module.exports = databaseController;