'use strict';

var navigationController = {};

navigationController.get = function(req, res, next) {
	require('../../navigation/admin').getAdmin(function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/general/navigation', data);
	});
};

module.exports = navigationController;