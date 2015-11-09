'use strict';

var async = require('async');
var nconf = require('nconf');

var databaseController = {};



databaseController.get = function(req, res, next) {
	async.parallel({
		redis: function(next) {
			if (nconf.get('redis')) {
				var rdb = require('../../database/redis');
				var cxn = rdb.connect();
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