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
			fs.readFile(themeConfigPath, 'utf8', function (err, config) {
				if (err) {
					if (err.code === 'ENOENT') {
						return next(Error('invalid-data'));
					}

					return next(err);
				}

				return next(null, config);
			});
		},
		function (themeConfig, next) {
			try {
				themeConfig = JSON.parse(themeConfig);
			} catch (e) {
				return next(e);
			}

			next(null, themeConfig.screenshot ? path.join(themeDir, themeConfig.screenshot) : defaultScreenshotPath);
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
