'use strict';

const appearanceController = {} as any;

appearanceController.get = function (req, res) {
	const term = req.params.term ? req.params.term : 'themes';

	res.render(`admin/appearance/${term}`, {});
};

export default appearanceController;
