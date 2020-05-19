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

		// var fml = process.hrtime();
		// await db.isSortedSetMember('users:joindate', '12312');
		// var c = await db.sortedSetUnionCard(['users:joindate', 'group:administrators:members']);
		// var d = await db.sortedSetIntersectCard(['users:joindate', 'group:administrators:members']);
		//  await db.getSortedSetRange('users:joindate', 0, -1);
		// await db.getSortedSetsMembers(['users:joindate']);
		// await db.getSortedSetsMembers(['group:administrators:members']);
		// console.log(d);
		// process.profile('count', fml);

		let sets = ['inttest1', 'inttest2'];
		sets = ['users:joindate', 'inttest1'];
		// sets = ['users:joindate', 'fail'];
		// sets = ['users:joindate', 'group:administrators:members'];
		// sets = ['group:administrators:members', 'users:joindate'];
		// sets = ['cid:2:tids', 'inttest1'];
		// sets = ['inttest1', 'cid:2:tids'];
		// sets = ['tag:nodebb:topics', 'cid:2:tids'];
		var st = process.hrtime();
		const [data, count] = await Promise.all([
			db.getSortedSetRevIntersect({
				sets: sets,
				start: 0,
				stop: 19,
				weights: [1, 0],
			}),
			// db.sortedSetIntersectCard(sets),
		]);
		process.profile('int', st);
		res.json({ data: data, count: count });
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
