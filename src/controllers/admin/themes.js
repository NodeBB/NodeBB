'use strict';

var path = require('path');
var fs = require('fs');

var themesController = {};

themesController.get = function(req, res, next) {
	var themeDir = path.join(__dirname, '../../node_modules/' + req.params.theme);
	fs.exists(themeDir, function(exists) {
		if (exists) {
			var themeConfig = require(path.join(themeDir, 'theme.json')),
				screenshotPath = path.join(themeDir, themeConfig.screenshot);
			if (themeConfig.screenshot && fs.existsSync(screenshotPath)) {
				res.sendFile(screenshotPath);
			} else {
				res.sendFile(path.join(__dirname, '../../public/images/themes/default.png'));
			}
		} else {
			return next();
		}
	});
};

module.exports = themesController;