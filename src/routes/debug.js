'use strict';

const express = require('express');
const nconf = require('nconf');

const fs = require('fs').promises;
const path = require('path');

module.exports = function (app) {
	const router = express.Router();

	router.get('/test', async (req, res) => {
		res.redirect(404);
	});

	// Redoc
	router.get('/spec/:type', async (req, res, next) => {
		const types = ['read', 'write'];
		const { type } = req.params;
		if (!types.includes(type)) {
			return next();
		}

		const handle = await fs.open(path.resolve(__dirname, '../../public/vendor/redoc/index.html'), 'r');
		let html = await handle.readFile({
			encoding: 'utf-8',
		});
		await handle.close();

		html = html.replace('apiUrl', `${nconf.get('relative_path')}/assets/openapi/${type}.yaml`);
		res.status(200).type('text/html').send(html);
	});

	app.use(`${nconf.get('relative_path')}/debug`, router);
};
