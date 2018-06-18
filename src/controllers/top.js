
'use strict';

var async = require('async');
var recentController = require('./recent');

var topController = module.exports;

topController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			recentController.getData(req, 'top', 'votes', next);
		},
		function (data, next) {
			if (!data) {
				return next();
			}
			res.render('top', data);
		},
	], next);
};
