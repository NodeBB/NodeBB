
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

Thumbs.exists = async function (tid, path) {
	// TODO: tests
	return db.isSortedSetMember(`topic:${tid}:thumbs`, path);
};

Thumbs.load = async function (topicData) {
	const topicsWithThumbs = topicData.filter(t => t && parseInt(t.numThumbs, 10) > 0);
	const tidsWithThumbs = topicsWithThumbs.map(t => t.tid);
	const thumbs = await Thumbs.get(tidsWithThumbs);
	const tidToThumbs = _.zipObject(tidsWithThumbs, thumbs);
	return topicData.map(t => tidToThumbs[t.tid] || []);
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
		url: thumb.startsWith('http') ? thumb : path.posix.join(upload_url, thumb),
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

Thumbs.associate = async function ({ id, path: relativePath, url }) {
	// Associates a newly uploaded file as a thumb to the passed-in draft or topic
	const isDraft = validator.isUUID(String(id));
	let value = relativePath || url;
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
	const numThumbs = await db.sortedSetCard(set);

	// Normalize the path to allow for changes in upload_path (and so upload_url can be appended if needed)
	if (relativePath) {
		value = value.replace(nconf.get('upload_path'), '');
	}
	const topics = require('.');
	await db.sortedSetAdd(set, numThumbs, value);
	if (!isDraft) {
		await topics.setTopicField(id, 'numThumbs', numThumbs);
	}
	cache.del(set);

	// Associate thumbnails with the main pid (only on local upload)
	if (!isDraft && relativePath) {
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
	cache.del(set);
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
		cache.del(set);

		if (existsOnDisk) {
			await file.delete(absolutePath);
		}

		// Dissociate thumbnails with the main pid
		if (!isDraft) {
			const topics = require('.');
			const numThumbs = await db.sortedSetCard(set);
			if (!numThumbs) {
				await db.deleteObjectField(`topic:${id}`, 'numThumbs');
			}
			const mainPid = (await topics.getMainPids([id]))[0];
			posts.uploads.dissociate(mainPid, relativePath.replace('/files/', ''));
		}
	}
};
