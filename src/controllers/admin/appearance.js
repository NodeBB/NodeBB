'use strict';

const meta = require('../../meta');

const appearanceController = module.exports;

appearanceController.themes = async function (req, res) {
	const themes = await meta.themes.get();
	res.render(`admin/appearance/themes`, { themes });
};

appearanceController.skins = function (req, res) {
	res.render(`admin/appearance/skins`, {});
};

appearanceController.customise = function (req, res) {
	res.render(`admin/appearance/customise`, {});
};
