'use strict';

var path = require('path');
var fs = require('fs');
var async = require('async');

var file = require('../../file');

var themesController = {};

var defaultScreenshotPath = path.join(__dirname, '../../../public/images/themes/default.png');

themesController.get = function (req, res, next) {
	var themeDir = path.join(__dirname, '../../../node_modules', req.params.theme);
	var themeConfigPath = path.join(themeDir, 'theme.json');

	async.waterfall([
		function (next) {
			file.exists(themeConfigPath, function (err, exists) {
				if (err) {
					return next(err);
				}
				if (!exists) {
					return next(Error('invalid-data'));
				}

				next();
			});
		},
		function (next) {
			fs.readFile(themeConfigPath, next);
		},
		function (themeConfig, next) {
			try {
				themeConfig = JSON.parse(themeConfig);
				next(null, themeConfig.screenshot ? path.join(themeDir, themeConfig.screenshot) : defaultScreenshotPath);
			} catch (e) {
				next(e);
			}
		},
		function (screenshotPath, next) {
			file.exists(screenshotPath, function (err, exists) {
				if (err) {
					return next(err);
				}

				res.sendFile(exists ? screenshotPath : defaultScreenshotPath);
			});
		},
	], next);
};

module.exports = themesController;
