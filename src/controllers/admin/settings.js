'use strict';

var settingsController = {};

settingsController.get = function(req, res, next) {
	var term = req.params.term ? req.params.term : 'general';

	res.render('admin/settings/' + term);
};

module.exports = settingsController;