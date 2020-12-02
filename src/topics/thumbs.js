
'use strict';

var nconf = require('nconf');
var path = require('path');
var fs = require('fs');
var request = require('request');
var mime = require('mime');
var validator = require('validator');
var util = require('util');

const db = require('../database');
var meta = require('../meta');
var image = require('../image');
var file = require('../file');
var plugins = require('../plugins');

const Thumbs = {};
module.exports = Thumbs;

const getHead = util.promisify(request.head);

function pipeToFile(source, destination, callback) {
	request(source).pipe(fs.createWriteStream(destination)).on('close', callback);
}
const pipeToFileAsync = util.promisify(pipeToFile);

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

Thumbs.resizeAndUpload = async function (data) {
	const allowedExtensions = file.allowedExtensions();

	// Handle protocol-relative URLs
	if (data.thumb && data.thumb.startsWith('//')) {
		data.thumb = `${nconf.get('secure') ? 'https' : 'http'}:${data.thumb}`;
	}

	// Only continue if passed in thumbnail exists and is a URL. A system path means an upload is not necessary.
	if (!data.thumb || !validator.isURL(data.thumb)) {
		return;
	}
	var pathToUpload;
	const res = await getHead(data.thumb);

	try {
		const type = res.headers['content-type'];
		if (!type.match(/image./)) {
			throw new Error('[[error:invalid-file]]');
		}

		var extension = path.extname(data.thumb);
		if (!extension) {
			extension = '.' + mime.getExtension(type);
		}

		if (!allowedExtensions.includes(extension)) {
			throw new Error('[[error:invalid-file]]');
		}

		const filename = Date.now() + '-topic-thumb' + extension;
		const folder = 'files';
		pathToUpload = path.join(nconf.get('upload_path'), folder, filename);

		await pipeToFileAsync(data.thumb, pathToUpload);

		await image.isFileTypeAllowed(pathToUpload);

		await image.checkDimensions(pathToUpload);
		await image.resizeImage({
			path: pathToUpload,
			width: meta.config.topicThumbSize,
			height: meta.config.topicThumbSize,
		});

		if (!plugins.hooks.hasListeners('filter:uploadImage')) {
			data.thumb = '/assets/uploads/' + folder + '/' + filename;
			return;
		}

		const uploadedFile = await plugins.hooks.fire('filter:uploadImage', {
			image: { path: pathToUpload, name: '' },
			uid: data.uid,
			folder: folder,
		});
		file.delete(pathToUpload);
		data.thumb = uploadedFile.url;
	} catch (err) {
		file.delete(pathToUpload);
		throw err;
	}
};
