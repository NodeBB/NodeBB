'use strict';

const loggerController = module.exports;

loggerController.get = function (req, res) {
	res.render('admin/development/logger', {});
};
