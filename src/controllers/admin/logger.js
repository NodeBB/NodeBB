'use strict';

var loggerController = {};

loggerController.get = function(req, res) {
	res.render('admin/development/logger', {});
};

module.exports = loggerController;