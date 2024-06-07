'use strict';

const crypto = require('crypto');

const db = require('../database');

const Attachments = module.exports;

Attachments.get = async (pid) => {
	const hashes = await db.getSortedSetMembers(`post:${pid}:attachments`);
	const keys = hashes.map(hash => `attachment:${hash}`);
	const attachments = (await db.getObjects(keys)).filter(Boolean);

	return attachments;
};

Attachments.update = async (pid, attachments) => {
	if (!attachments) {
		return;
	}

	const bulkOps = {
		hash: [],
		zset: {
			score: [],
			value: [],
		},
	};

	attachments.filter(Boolean).forEach(({ _type, mediaType, url, name, width, height }, idx) => {
		if (!url) { // only required property
			return;
		}

		const hash = crypto.createHash('sha256').update(url).digest('hex');
		const key = `attachment:${hash}`;

		if (_type) {
			_type = 'attachment';
		}

		bulkOps.hash.push([key, { _type, mediaType, url, name, width, height }]);
		bulkOps.zset.score.push(idx);
		bulkOps.zset.value.push(hash);
	});

	await Promise.all([
		db.setObjectBulk(bulkOps.hash),
		db.sortedSetAdd(`post:${pid}:attachments`, bulkOps.zset.score, bulkOps.zset.value),
	]);
};

Attachments.empty = async (pids) => {
	const zsets = pids.map(pid => `post:${pid}:attachments`);
	const hashes = await db.getSortedSetsMembers(zsets);
	let keys = hashes.reduce((memo, hashes) => new Set([...memo, ...hashes]), new Set());
	keys = Array.from(keys).map(hash => `attachment:${hash}`);

	await db.deleteAll(keys.concat(zsets));
};
