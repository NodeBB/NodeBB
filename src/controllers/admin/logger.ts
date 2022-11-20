'use strict';

const loggerController  = {} as any;

loggerController.get = function (req, res) {
	res.render('admin/development/logger', {});
};
