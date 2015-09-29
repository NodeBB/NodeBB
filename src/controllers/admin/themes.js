'use strict';

var path = require('path');
var file = require('../../file');

var themesController = {};

themesController.get = function(req, res, next) {
	var themeDir = path.join(__dirname, '../../../node_modules/' + req.params.theme);
	file.exists(themeDir, function(exists) {
		if (!exists) {
			return next();
		}

		var themeConfig = require(path.join(themeDir, 'theme.json')),
			screenshotPath = path.join(themeDir, themeConfig.screenshot);
		if (themeConfig.screenshot && file.existsSync(screenshotPath)) {
			res.sendFile(screenshotPath);
		} else {
			res.sendFile(path.join(__dirname, '../../../public/images/themes/default.png'));
		}
	});
};

module.exports = themesController;