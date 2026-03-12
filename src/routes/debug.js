'use strict';

const express = require('express');
const nconf = require('nconf');

const fs = require('fs').promises;
const path = require('path');

module.exports = function (app) {
	const router = express.Router();


	router.get('/test', async (req, res) => {
		// res.redirect(404);
		const db = require('../database');
		const groupNames = [];
		for (let i = 0; i < 50; ++i) {
			groupNames.push(`randomgroup:${i}`);
		}
		const uids = [];
		for (let i = 0; i < 50; ++i) {
			uids.push(i);
		}

		await db.setAdd('debugset', ['a', 'b', 'c']);
		// const gg = await db.isMemberOfSets(['debugset', 'foo'], 'b');
		// const gg = await db.isSetMembers('debugset', ['b', 'd']);
		const gg = await db.isSetMember('debugset', 'b');
		return res.json({ stats: gg});
		async function checkThenDelete() {
			await Promise.all(uids.map(async (uid) => {
				const isMember = await db.isMemberOfSets(groupNames, uid);
				const toRemove = groupNames.filter((g, i) => isMember[i]);
				if (toRemove.length) {
					await db.setsRemove(toRemove, uid);
				}
			}));
		}
		async function straightRemove() {
			await Promise.all(uids.map(async (uid) => {
				await db.setsRemove(groupNames, uid);
			}));
		}
		const st = process.hrtime();
		// await checkThenDelete();
		process.profile('check then delte', st);

		const st1 = process.hrtime();
		// await straightRemove();
		process.profile('straight remove', st1);
		res.json('ok');
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
