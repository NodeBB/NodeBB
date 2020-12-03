
'use strict';

var nconf = require('nconf');
var path = require('path');

const db = require('../database');
var file = require('../file');
var plugins = require('../plugins');

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

	const sets = tids.map(tid => `topic:${tid}:thumbs`);
	const thumbs = await db.getSortedSetsMembers(sets);
	let response = thumbs.map(thumbSet => thumbSet.map(thumb => ({
		url: path.join(nconf.get('upload_url'), thumb),
	})));

	({ thumbs: response } = await plugins.hooks.fire('filter:topics.getThumbs', { tids, thumbs: response }));
	return singular ? response.pop() : response;
};

Thumbs.associate = async function (id, path, isDraft) {
	// Associates a newly uploaded file as a thumb to the passed-in tid
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const numThumbs = await db.sortedSetCard(set);
	path = path.replace(nconf.get('upload_path'), '');
	db.sortedSetAdd(set, numThumbs, path);
};

Thumbs.commit = async function (uuid, tid) {
	// Converts the draft thumb zset to the topic zset (combines thumbs if applicable)
	const set = `draft:${uuid}:thumbs`;
	const thumbs = await db.getSortedSetRange(set, 0, -1);
	await Promise.all(thumbs.map(async path => await Thumbs.associate(tid, path, false)));
	await db.delete(set);
};

Thumbs.delete = async function (tid, relativePath) {
	// TODO: tests
	const set = `topic:${tid}:thumbs`;
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
