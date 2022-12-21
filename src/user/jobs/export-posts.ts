'use strict';

const nconf = require('nconf');

nconf.argv().env({
	separator: '__',
});

const fs = require('fs');
const path = require('path');
const json2csvAsync = require('json2csv').parseAsync;

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, '../../../', nconf.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');

prestart.loadConfig(configFile);
prestart.setupWinston();

const db = require('../../database');
const batch = require('../../batch');

process.on('message', async (msg) => {
	if (msg && msg.uid) {
		await db.init();

		const targetUid = msg.uid;
		const filePath = path.join(__dirname, '../../../build/export', `${targetUid}_posts.csv`);

		const posts = require('../../posts');

		let payload = [];
		await batch.processSortedSet(`uid:${targetUid}:posts`, async (pids) => {
			let postData = await posts.getPostsData(pids);
			// Remove empty post references and convert newlines in content
			postData = postData.filter(Boolean).map((post) => {
				post.content = `"${String(post.content || '').replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`;
				return post;
			});
			payload = payload.concat(postData);
		}, {
			batch: 500,
			interval: 1000,
		});

		const fields = payload.length ? Object.keys(payload[0]) : [];
		const opts = { fields };
		const csv = await json2csvAsync(payload, opts);
		await fs.promises.writeFile(filePath, csv);

		await db.close();
		process.exit(0);
	}
});
