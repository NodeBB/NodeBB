'use strict';

import nconf from 'nconf';

nconf.argv().env({
	separator: '__',
});

import * as fs from 'fs';
import path from 'path';const json2csvAsync = require('json2csv').parseAsync;

(process as any).env.NODE_ENV = (process as any).env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, '../../../', nconf.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');

prestart.loadConfig(configFile);
prestart.setupWinston();

import db from '../../database';
const batch = require('../../batch');

(process as any).on('message', async (msg: any) => {
	if (msg && msg.uid) {
		await db.init();

		const targetUid = msg.uid;
		const filePath = path.join(__dirname, '../../../build/export', `${targetUid}_posts.csv`);

		const posts = require('../../posts');

		let payload : any[] = [];
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
		(process as any).exit(0);
	}
});
