"use strict";

var appearanceController = {};

appearanceController.get = function(req, res, next) {
	var term = req.params.term ? req.params.term : 'themes';

	res.render('admin/appearance/' + term, {});
};


module.exports = appearanceController;
