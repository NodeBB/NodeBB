'use strict';

var appearanceController = module.exports;

appearanceController.get = function (req, res) {
	var term = req.params.term ? req.params.term : 'themes';

	res.render('admin/appearance/' + term, {});
};
