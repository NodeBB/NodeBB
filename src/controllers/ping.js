'use strict';

var async = require('async');
var db = require('../database');

module.exports.ping = function (req, res, next) {
	async.waterfall([
		function (next) {
			db.getObject('config', next);
		},
		function () {
			res.status(200).send(req.path === '/sping' ? 'healthy' : '200');
		},
	], next);
};
