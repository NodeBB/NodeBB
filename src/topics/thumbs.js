
'use strict';

const nconf = require('nconf');
const path = require('path');
const validator = require('validator');

const db = require('../database');
const file = require('../file');
const plugins = require('../plugins');
const posts = require('../posts');

const Thumbs = {};
module.exports = Thumbs;


Thumbs.exists = async function (tid, path) {
	// TODO: tests
	return db.isSortedSetMember(`topic:${tid}:thumbs`, path);
};

Thumbs.get = async function (tids) {
	// Allow singular or plural usage
	let singular = false;
	if (!Array.isArray(tids)) {
		tids = [tids];
		singular = true;
	}

	const sets = tids.map(tid => `${validator.isUUID(String(tid)) ? 'draft' : 'topic'}:${tid}:thumbs`);
	const thumbs = await db.getSortedSetsMembers(sets);
	let response = thumbs.map((thumbSet, idx) => thumbSet.map(thumb => ({
		id: tids[idx],
		name: path.basename(thumb),
		url: thumb.startsWith('http') ? thumb : path.join(nconf.get('upload_url'), thumb),
	})));

	({ thumbs: response } = await plugins.hooks.fire('filter:topics.getThumbs', { tids, thumbs: response }));
	return singular ? response.pop() : response;
};

Thumbs.associate = async function ({ id, path: relativePath, url }) {
	// Associates a newly uploaded file as a thumb to the passed-in draft or topic
	const isDraft = validator.isUUID(String(id));
	const value = relativePath || url;
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const numThumbs = await db.sortedSetCard(set);

	// Normalize the path to allow for changes in upload_path (and so upload_url can be appended if needed)
	if (relativePath) {
		relativePath = relativePath.replace(nconf.get('upload_path'), '');
	}

	db.sortedSetAdd(set, numThumbs, value);

	// Associate thumbnails with the main pid (only on local upload)
	if (!isDraft && relativePath) {
		const topics = require('.');
		const mainPid = (await topics.getMainPids([id]))[0];
		posts.uploads.associate(mainPid, relativePath.replace('/files/', ''));
	}
};

Thumbs.migrate = async function (uuid, id) {
	// Converts the draft thumb zset to the topic zset (combines thumbs if applicable)
	const set = `draft:${uuid}:thumbs`;
	const thumbs = await db.getSortedSetRange(set, 0, -1);
	await Promise.all(thumbs.map(async path => await Thumbs.associate({ id, path })));
	await db.delete(set);
};

Thumbs.delete = async function (id, relativePath) {
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const absolutePath = path.join(nconf.get('upload_path'), relativePath);
	const [associated, existsOnDisk] = await Promise.all([
		db.isSortedSetMember(set, relativePath),
		file.exists(absolutePath),
	]);

	if (associated) {
		await db.sortedSetRemove(set, relativePath);

		if (existsOnDisk) {
			await file.delete(absolutePath);
		}

		// Dissociate thumbnails with the main pid
		if (!isDraft) {
			const topics = require('.');
			const mainPid = (await topics.getMainPids([id]))[0];
			posts.uploads.dissociate(mainPid, relativePath.replace('/files/', ''));
		}
	}
};
