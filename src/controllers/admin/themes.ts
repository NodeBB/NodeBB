'use strict';

import path from 'path';
import fs from 'fs';
import file from '../../file';
import { paths } from '../../constants';

const themesController = {} as any;

const defaultScreenshotPath = path.join(__dirname, '../../../public/images/themes/default.png');

themesController.get = async function (req, res, next) {
	const themeDir = path.join(paths.nodeModules, req.params.theme);
	const themeConfigPath = path.join(themeDir, 'theme.json');

	let themeConfig;
	try {
		themeConfig = await fs.promises.readFile(themeConfigPath, 'utf8');
		themeConfig = JSON.parse(themeConfig);
	} catch (err: any) {
		if (err.code === 'ENOENT') {
			return next(Error('invalid-data'));
		}
		return next(err);
	}

	const screenshotPath = themeConfig.screenshot ? path.join(themeDir, themeConfig.screenshot) : defaultScreenshotPath;
	const exists = await file.exists(screenshotPath);
	res.sendFile(exists ? screenshotPath : defaultScreenshotPath);
};

export default themesController;