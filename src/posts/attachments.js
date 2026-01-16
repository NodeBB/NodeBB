'use strict';

const crypto = require('crypto');
const _ = require('lodash');
const mime = require('mime');

const db = require('../database');

const Attachments = module.exports;
const posts = require('./index');

Attachments.get = async (pids) => {
	const isArray = Array.isArray(pids);
	if (!isArray) {
		pids = [pids];
	}
	const postData = await posts.getPostsFields(pids, [`attachments`]);
	const allHashes = _.flatten(postData.map(p => p && p.attachments));
	const allAttachments = await Attachments.getAttachments(allHashes);
	const hashToAttachment = _.zipObject(allHashes, allAttachments);
	const data = postData.map((post) => {
		const pidHashes = post ? post.attachments : [];
		return pidHashes.map(hash => hashToAttachment[hash]);
	});
	return isArray ? data : data[0];
};

Attachments.getAttachments = async (hashes) => {
	const keys = hashes.map(hash => `attachment:${hash}`);
	return (await db.getObjects(keys)).filter(Boolean);
};

Attachments.update = async (pid, attachments) => {
	if (!attachments) {
		return;
	}

	const bulkOps = {
		hash: [],
	};
	const hashes = [];
	attachments.filter(Boolean).forEach(({ _type, mediaType, href, url, name, width, height }) => {
		if (!url && !href) { // one or the other are required
			return;
		}

		if (!url && href) {
			url = href;
		}

		const hash = crypto.createHash('sha256').update(url).digest('hex');
		const key = `attachment:${hash}`;

		if (_type) {
			_type = 'attachment';
		}

		if (!mediaType) { // MIME type guessing
			const { pathname } = new URL(url);
			mediaType = mime.getType(pathname);
		}

		bulkOps.hash.push([key, { _type, mediaType, url, name, width, height }]);
		hashes.push(hash);
	});

	await Promise.all([
		db.setObjectBulk(bulkOps.hash),
		db.setObjectField(`post:${pid}`, 'attachments', hashes.join(',')),
		posts.clearCachedPost(pid),
	]);
};

Attachments.empty = async (pids) => {
	const postKeys = pids.map(pid => `post:${pid}`);
	const hashes = await posts.getPostsFields(postKeys, ['attachments']);
	const keys = _.uniq(_.flatten(hashes));
	await Promise.all([
		db.deleteAll(keys.map(hash => `attachment:${hash}`)),
		db.deleteObjectFields(postKeys, ['attachments']),
	]);
};
