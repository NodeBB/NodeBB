'use strict';

const appearanceController = module.exports;

appearanceController.themes = function (req, res) {
	res.render(`admin/appearance/themes`, {});
};

appearanceController.skins = function (req, res) {
	res.render(`admin/appearance/skins`, {});
};

appearanceController.customise = function (req, res) {
	res.render(`admin/appearance/customise`, {});
};
