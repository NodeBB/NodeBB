'use strict';

var async = require('async');

var meta = require('../../meta'),
	analytics = require('../../analytics');

var errorsController = {};

errorsController.get = function(req, res) {
	async.parallel({
		'not-found': async.apply(meta.errors.get),
		analytics: async.apply(analytics.getErrorAnalytics)
	}, function(err, data) {
		res.render('admin/advanced/errors', data);
	});
};


module.exports = errorsController;