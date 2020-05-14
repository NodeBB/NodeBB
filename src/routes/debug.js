'use strict';

var express = require('express');
var nconf = require('nconf');

const fs = require('fs').promises;
const path = require('path');

module.exports = function (app) {
	var router = express.Router();

	router.get('/test', async function (req, res) {
		var db = require('../database');
		var st = process.hrtime();
		// const data = await db.getSortedSetRevIntersect({
		// 	sets: ['users:joindate', 'group:administrators:members'],
		// 	// sets: ['cid:7:tids', 'tag:plugins:topics'],
		// 	start: 0,
		// 	stop: 19,
		// 	weights: [1, 0],
		// });
		var data = await db.sortedSetScore('userslug:uid', 'baris');
		process.profile('st', st);
		res.json(data);
		// res.redirect(404);
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
