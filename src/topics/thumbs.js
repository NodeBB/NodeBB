
'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const path = require('path');
const validator = require('validator');

const db = require('../database');
const file = require('../file');
const plugins = require('../plugins');
const posts = require('../posts');
const meta = require('../meta');
const cache = require('../cache');

const Thumbs = module.exports;

Thumbs.exists = async function (id, path) {
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;

	return db.isSortedSetMember(set, path);
};

Thumbs.load = async function (topicData) {
	const topicsWithThumbs = topicData.filter(t => t && parseInt(t.numThumbs, 10) > 0);
	const tidsWithThumbs = topicsWithThumbs.map(t => t.tid);
	const thumbs = await Thumbs.get(tidsWithThumbs);
	const tidToThumbs = _.zipObject(tidsWithThumbs, thumbs);
	return topicData.map(t => (t && t.tid ? (tidToThumbs[t.tid] || []) : []));
};

Thumbs.get = async function (tids) {
	// Allow singular or plural usage
	let singular = false;
	if (!Array.isArray(tids)) {
		tids = [tids];
		singular = true;
	}

	if (!meta.config.allowTopicsThumbnail || !tids.length) {
		return singular ? [] : tids.map(() => []);
	}

	const hasTimestampPrefix = /^\d+-/;
	const upload_url = nconf.get('relative_path') + nconf.get('upload_url');
	const sets = tids.map(tid => `${validator.isUUID(String(tid)) ? 'draft' : 'topic'}:${tid}:thumbs`);
	const thumbs = await Promise.all(sets.map(getThumbs));
	let response = thumbs.map((thumbSet, idx) => thumbSet.map(thumb => ({
		id: tids[idx],
		name: (() => {
			const name = path.basename(thumb);
			return hasTimestampPrefix.test(name) ? name.slice(14) : name;
		})(),
		path: thumb,
		url: thumb.startsWith('http') ? thumb : path.posix.join(upload_url, thumb.replace(/\\/g, '/')),
	})));

	({ thumbs: response } = await plugins.hooks.fire('filter:topics.getThumbs', { tids, thumbs: response }));
	return singular ? response.pop() : response;
};

async function getThumbs(set) {
	const cached = cache.get(set);
	if (cached !== undefined) {
		return cached.slice();
	}
	const thumbs = await db.getSortedSetRange(set, 0, -1);
	cache.set(set, thumbs);
	return thumbs.slice();
}

Thumbs.associate = async function ({ id, path, score }) {
	// Associates a newly uploaded file as a thumb to the passed-in draft or topic
	const isDraft = validator.isUUID(String(id));
	const isLocal = !path.startsWith('http');
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const numThumbs = await db.sortedSetCard(set);

	// Normalize the path to allow for changes in upload_path (and so upload_url can be appended if needed)
	if (isLocal) {
		path = path.replace(nconf.get('upload_path'), '');
	}
	const topics = require('.');
	await db.sortedSetAdd(set, isFinite(score) ? score : numThumbs, path);
	if (!isDraft) {
		const numThumbs = await db.sortedSetCard(set);
		await topics.setTopicField(id, 'numThumbs', numThumbs);
	}
	cache.del(set);

	// Associate thumbnails with the main pid (only on local upload)
	if (!isDraft && isLocal) {
		const mainPid = (await topics.getMainPids([id]))[0];
		await posts.uploads.associate(mainPid, path.slice(1));
	}
};

Thumbs.migrate = async function (uuid, id) {
	// Converts the draft thumb zset to the topic zset (combines thumbs if applicable)
	const set = `draft:${uuid}:thumbs`;
	const thumbs = await db.getSortedSetRangeWithScores(set, 0, -1);
	await Promise.all(thumbs.map(async thumb => await Thumbs.associate({
		id,
		path: thumb.value,
		score: thumb.score,
	})));
	await db.delete(set);
	cache.del(set);
};

Thumbs.delete = async function (id, relativePaths) {
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;

	if (typeof relativePaths === 'string') {
		relativePaths = [relativePaths];
	} else if (!Array.isArray(relativePaths)) {
		throw new Error('[[error:invalid-data]]');
	}

	const absolutePaths = relativePaths.map(relativePath => path.join(nconf.get('upload_path'), relativePath));
	const [associated, existsOnDisk] = await Promise.all([
		db.isSortedSetMembers(set, relativePaths),
		Promise.all(absolutePaths.map(async absolutePath => file.exists(absolutePath))),
	]);

	const toRemove = [];
	const toDelete = [];
	relativePaths.forEach((relativePath, idx) => {
		if (associated[idx]) {
			toRemove.push(relativePath);
		}

		if (existsOnDisk[idx]) {
			toDelete.push(absolutePaths[idx]);
		}
	});

	await db.sortedSetRemove(set, toRemove);

	if (isDraft && toDelete.length) { // drafts only; post upload dissociation handles disk deletion for topics
		await Promise.all(toDelete.map(async absolutePath => file.delete(absolutePath)));
	}

	if (toRemove.length && !isDraft) {
		const topics = require('.');
		const mainPid = (await topics.getMainPids([id]))[0];

		await Promise.all([
			db.incrObjectFieldBy(`topic:${id}`, 'numThumbs', -toRemove.length),
			Promise.all(toRemove.map(async relativePath => posts.uploads.dissociate(mainPid, relativePath.slice(1)))),
		]);
	}
	if (toRemove.length) {
		cache.del(set);
	}
};

Thumbs.deleteAll = async (id) => {
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;

	const thumbs = await db.getSortedSetRange(set, 0, -1);
	await Thumbs.delete(id, thumbs);
};
