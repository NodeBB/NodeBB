'use strict';

var express = require('express');
var nconf = require('nconf');

const fs = require('fs').promises;
const path = require('path');

module.exports = function (app) {
	var router = express.Router();

	router.get('/test', async function (req, res) {
		// res.redirect(404);
		var db = require('../database');
		// await upgrade();

		const cids = await db.getSortedSetRevRange('categories:cid', 0, -1);
		console.log('cids.length', cids.length);
		var st = process.hrtime();
		const result = await db.getSortedSetRevUnion({
			// sets: ['cid:3:tags', 'cid:4:tags'],
			sets: cids.map(cid => 'cid:' + cid + ':tags'),
			withScores: true,
			start: 0,
			stop: 99,
		});
		process.profile('st', st);
		res.json(result);
	});

	// Redoc
	router.get('/spec/:type', async (req, res, next) => {
		const types = ['read', 'write'];
		const type = req.params.type;
		if (!types.includes(type)) {
			return next();
		}

		const handle = await fs.open(path.resolve(__dirname, '../../public/vendor/redoc/index.html'), 'r');
		let html = await handle.readFile({
			encoding: 'utf-8',
		});
		await handle.close();

		html = html.replace('apiUrl', nconf.get('relative_path') + '/assets/openapi/' + type + '.yaml');
		res.status(200).type('text/html').send(html);
	});

	app.use(nconf.get('relative_path') + '/debug', router);
};
