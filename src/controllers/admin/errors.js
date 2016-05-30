'use strict';

var async = require('async'),
	json2csv = require('json-2-csv').json2csv;

var meta = require('../../meta'),
	analytics = require('../../analytics');

var errorsController = {};

errorsController.get = function(req, res) {
	async.parallel({
		'not-found': async.apply(meta.errors.get, true),
		analytics: async.apply(analytics.getErrorAnalytics)
	}, function(err, data) {
		res.render('admin/advanced/errors', data);
	});
};

errorsController.export = function(req, res) {
	async.waterfall([
		async.apply(meta.errors.get, false),
		async.apply(json2csv)
	], function(err, csv) {
		res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="404.csv"').send(csv);
	});
};


module.exports = errorsController;