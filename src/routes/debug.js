'use strict';

var express = require('express');
var nconf = require('nconf');

const fs = require('fs').promises;
const path = require('path');

module.exports = function (app) {
	var router = express.Router();

	router.get('/test', function (req, res) {
		res.redirect(404);
	});

	// Redoc
	router.get('/spec/read', async (req, res) => {
		const handle = await fs.open(path.resolve(__dirname, '../../public/vendor/redoc/index.html'), 'r');
		let html = await handle.readFile({
			encoding: 'utf-8',
		});
		await handle.close();

		html = html.replace('apiUrl', nconf.get('relative_path') + '/assets/openapi/read.yaml');
		res.status(200).type('text/html').send(html);
	});

	app.use(nconf.get('relative_path') + '/debug', router);
};
