'use strict';

var async = require('async');
var validator = require('validator');

var meta = require('../../meta');

var logsController = module.exports;

logsController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			meta.logs.get(next);
		},
		function (logs) {
			res.render('admin/advanced/logs', {
				data: validator.escape(logs),
			});
		},
	], next);
};


module.exports = logsController;
