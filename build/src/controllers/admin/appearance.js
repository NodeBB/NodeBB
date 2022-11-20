'use strict';
const appearanceController = {};
appearanceController.get = function (req, res) {
    const term = req.params.term ? req.params.term : 'themes';
    res.render(`admin/appearance/${term}`, {});
};
