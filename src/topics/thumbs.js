
'use strict';

const nconf = require('nconf');
const path = require('path');
const validator = require('validator');

const db = require('../database');
const file = require('../file');
const plugins = require('../plugins');

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
	let response = thumbs.map(thumbSet => thumbSet.map(thumb => ({
		url: path.join(nconf.get('upload_url'), thumb),
	})));

	({ thumbs: response } = await plugins.hooks.fire('filter:topics.getThumbs', { tids, thumbs: response }));
	return singular ? response.pop() : response;
};

Thumbs.associate = async function (id, path) {
	// Associates a newly uploaded file as a thumb to the passed-in draft or topic
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const numThumbs = await db.sortedSetCard(set);
	path = path.replace(nconf.get('upload_path'), '');
	db.sortedSetAdd(set, numThumbs, path);
};

Thumbs.migrate = async function (uuid, id) {
	// Converts the draft thumb zset to the topic zset (combines thumbs if applicable)
	const set = `draft:${uuid}:thumbs`;
	const thumbs = await db.getSortedSetRange(set, 0, -1);
	await Promise.all(thumbs.map(async path => await Thumbs.associate(id, path)));
	await db.delete(set);
};

Thumbs.delete = async function (id, relativePath) {
	// TODO: tests
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const absolutePath = path.join(nconf.get('upload_path'), relativePath);
	const [associated, existsOnDisk] = await Promise.all([
		db.isSortedSetMember(set, relativePath),
		file.exists(absolutePath),
	]);

	if (associated) {
		await db.sortedSetRemove(set, relativePath);
	}
	if (existsOnDisk) {
		await file.delete(absolutePath);
	}
};
