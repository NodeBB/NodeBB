'use strict';

const { readFile, access, constants } = require('fs/promises');
const path = require('path');
const nconf = require('nconf');

const plugins = require('../plugins');

const Controller = module.exports;

Controller.generate = async (req, res) => {
	const swPath = path.join(__dirname, '../../build/public/src/service-worker.js');
	let swContents = await readFile(swPath, { encoding: 'utf-8' });

	res.status(200)
		.type('application/javascript')
		.set('Service-Worker-Allowed', `${nconf.get('relative_path')}/`);

	/**
	 * Allow plugins to append their own scripts for the service worker to import
	 * expects: URLs in passed-in Set, either absolute or relative to plugin static directory root (/assets/plugins)
	 * see: https://docs.nodebb.org/development/plugins/statics
	 */
	let scripts = new Set();
	({ scripts } = await plugins.hooks.fire('filter:service-worker.scripts', { scripts }));

	if (!scripts.size) {
		res.sendFile(swPath);
	} else {
		const urls = await Promise.all(Array
			.from(scripts)
			.map(async (pathname) => {
				try {
					const url = new URL(pathname, `${nconf.get('url')}/assets/plugins/`);
					if (url.href.startsWith(nconf.get('url'))) {
						const fullPath = path.resolve(__dirname, '../../build/public/plugins', url.pathname.replace(`${nconf.get('relative_path')}/assets/plugins/`, ''));
						await access(fullPath, constants.R_OK);
					}
					return url;
				} catch (e) {
					return null;
				}
			}));

		const payload = urls.map(urlObj => urlObj.href).join("', '");
		swContents += `\nimportScripts('${payload}')`;
		res.send(swContents);
	}
};
