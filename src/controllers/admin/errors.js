'use strict';

var async = require('async');
var json2csv = require('json-2-csv').json2csv;

var meta = require('../../meta');
var analytics = require('../../analytics');

var errorsController = {};

errorsController.get = function (req, res, next) {
	async.parallel({
		'not-found': async.apply(meta.errors.get, true),
		analytics: async.apply(analytics.getErrorAnalytics),
	}, function (err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/advanced/errors', data);
	});
};

errorsController.export = function (req, res, next) {
	async.waterfall([
		async.apply(meta.errors.get, false),
		async.apply(json2csv),
	], function (err, csv) {
		if (err) {
			return next(err);
		}

		res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="404.csv"').send(csv);
	});
};


module.exports = errorsController;