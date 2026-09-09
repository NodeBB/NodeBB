'use strict';

const path = require('path');
const fs = require('fs');

const file = require('../../file');
const { paths, themeNamePattern } = require('../../constants');

const themesController = module.exports;

const defaultScreenshotPath = path.join(__dirname, '../../../public/images/themes/default.png');

themesController.get = async function (req, res) {
	if (!themeNamePattern.test(req.params.theme)) {
		throw new Error('[[error:invalid-data]]');
	}
	const themeDir = path.join(paths.nodeModules, req.params.theme);
	const themeConfigPath = path.join(themeDir, 'theme.json');

	let themeConfig;
	try {
		themeConfig = await fs.promises.readFile(themeConfigPath, 'utf8');
		themeConfig = JSON.parse(themeConfig);
	} catch (err) {
		if (err.code === 'ENOENT') {
			throw new Error('[[error:invalid-data]]');
		}
		throw err;
	}

	const screenshotPath = themeConfig.screenshot ?
		path.join(themeDir, themeConfig.screenshot) :
		'';

	if (screenshotPath && !screenshotPath.startsWith(themeDir)) {
		throw new Error('[[error:invalid-path]]');
	}
	const exists = screenshotPath ? await file.exists(screenshotPath) : false;
	res.sendFile(exists ? screenshotPath : defaultScreenshotPath);
};
