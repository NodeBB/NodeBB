'use strict';

var path = require('path');
var fs = require('fs');
var async = require('async');

var file = require('../../file');

var themesController = module.exports;

var defaultScreenshotPath = path.join(__dirname, '../../../public/images/themes/default.png');

themesController.get = function (req, res, next) {
	var themeDir = path.join(__dirname, '../../../node_modules', req.params.theme);
	var themeConfigPath = path.join(themeDir, 'theme.json');
	var screenshotPath;
	async.waterfall([
		function (next) {
			file.exists(themeConfigPath, next);
		},
		function (exists, next) {
			if (!exists) {
				return next(Error('invalid-data'));
			}

			fs.readFile(themeConfigPath, 'utf8', next);
		},
		function (themeConfig, next) {
			try {
				themeConfig = JSON.parse(themeConfig);
				next(null, themeConfig.screenshot ? path.join(themeDir, themeConfig.screenshot) : defaultScreenshotPath);
			} catch (e) {
				next(e);
			}
		},
		function (_screenshotPath, next) {
			screenshotPath = _screenshotPath;
			file.exists(screenshotPath, next);
		},
		function (exists) {
			res.sendFile(exists ? screenshotPath : defaultScreenshotPath);
		},
	], next);
};

