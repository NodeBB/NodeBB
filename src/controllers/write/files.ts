'use strict';

import { promises as fs } from 'fs';
import helpers from '../helpers';

const Files = {} as any;

Files.delete = async (req, res) => {
	await fs.unlink(res.locals.cleanedPath);
	helpers.formatApiResponse(200, res);
};

Files.createFolder = async (req, res) => {
	await fs.mkdir(res.locals.folderPath);
	helpers.formatApiResponse(200, res);
};

export default Files;
