'use strict';

const nconf = require('nconf');
const path = require('path');
const fs = require('fs');
const file = require('../../file');

module.exports = {
	name: 'Store default favicon if it does not exist',
	timestamp: Date.UTC(2021, 2, 9),
	method: async function () {
		const pathToIco = path.join(nconf.get('upload_path'), 'system', 'favicon.ico');
		const defaultIco = path.join(nconf.get('base_dir'), 'public', 'favicon.ico');
		const exists = await file.exists(pathToIco);
		if (!exists) {
			await fs.promises.copyFile(defaultIco, pathToIco);
		}
	},
};
