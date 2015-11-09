'use strict';

var widgetsController = {};

widgetsController.get = function(req, res, next) {
	require('../../widgets/admin').get(function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/extend/widgets', data);
	});
};


module.exports = widgetsController;