'use strict';

var loggerController = module.exports;

loggerController.get = function (req, res) {
	res.render('admin/development/logger', {});
};
