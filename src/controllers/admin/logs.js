'use strict';

var validator = require('validator');
var meta = require('../../meta');


var logsController = {};

logsController.get = function(req, res, next) {
	meta.logs.get(function(err, logs) {
		if (err) {
			return next(err);
		}

		res.render('admin/advanced/logs', {
			data: validator.escape(logs)
		});
	});
};


module.exports = logsController;