'use strict';

var rewardsController = {};

rewardsController.get = function(req, res, next) {
	require('../../rewards/admin').get(function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/extend/rewards', data);
	});
};



module.exports = rewardsController;