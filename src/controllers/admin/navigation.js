'use strict';

var navigationController = {};

navigationController.get = function(req, res, next) {
	require('../../navigation/admin').getAdmin(function(err, data) {
		if (err) {
			return next(err);
		}


		data.enabled.forEach(function(enabled, index) {
			enabled.index = index;
			enabled.selected = index === 0;
		});

		data.navigation = data.enabled.slice();

		res.render('admin/general/navigation', data);
	});
};

module.exports = navigationController;