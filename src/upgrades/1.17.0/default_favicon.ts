'use strict';

import nconf from 'nconf';
import path from 'path';import fs from 'fs';
import file from '../../file';

export const obj = {
	name: 'Store default favicon if it does not exist',
	timestamp: Date.UTC(2021, 2, 9),
	method: async function () {
		const pathToIco = path.join(nconf.get('upload_path'), 'system', 'favicon.ico');
		const defaultIco = path.join(nconf.get('base_dir'), 'public', 'favicon.ico');
		const targetExists = await file.exists(pathToIco);
		const defaultExists = await file.exists(defaultIco);
		if (defaultExists && !targetExists) {
			await fs.promises.copyFile(defaultIco, pathToIco);
		}
	},
};
