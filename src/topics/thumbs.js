
'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const path = require('path');
const mime = require('mime');
const plugins = require('../plugins');
const posts = require('../posts');
const meta = require('../meta');

const topics = module.parent.exports;
const Thumbs = module.exports;

const upload_url = nconf.get('relative_path') + nconf.get('upload_url');
const upload_path = nconf.get('upload_path');

Thumbs.exists = async function (tid, path) {
	const thumbs = await topics.getTopicField(tid, 'thumbs');
	return thumbs.includes(path);
};

Thumbs.load = async function (topicData) {
	const mainPids = topicData.filter(Boolean).map(t => t.mainPid);
	const mainPostData = await posts.getPostsFields(mainPids, ['attachments', 'uploads']);
	const hasUploads = mainPostData.map(p => Array.isArray(p.uploads) && p.uploads.length > 0);
	const hashes = mainPostData.map(o => o.attachments);
	let hasThumbs = topicData.map((t, idx) => t &&
		(parseInt(t.numThumbs, 10) > 0 ||
		!!(hashes[idx] && hashes[idx].length) ||
		hasUploads[idx]));
	({ hasThumbs } = await plugins.hooks.fire('filter:topics.hasThumbs', { topicData, hasThumbs }));

	const topicsWithThumbs = topicData.filter((tid, idx) => hasThumbs[idx]);
	const tidsWithThumbs = topicsWithThumbs.map(t => t.tid);
	const thumbs = await loadFromTopicData(topicsWithThumbs, {
		thumbsOnly: meta.config.showPostUploadsAsThumbnails !== 1,
	});

	const tidToThumbs = _.zipObject(tidsWithThumbs, thumbs);
	return topicData.map(t => (t && t.tid ? (tidToThumbs[t.tid] || []) : []));
};

async function loadFromTopicData(topicData, options = {}) {
	const tids = topicData.map(t => t && t.tid);
	const thumbs = topicData.map(t => t && Array.isArray(t.thumbs) ? t.thumbs : []);

	if (!options.thumbsOnly) {
		const mainPids = topicData.map(t => t.mainPid);
		const [mainPidUploads, mainPidAttachments] = await Promise.all([
			posts.uploads.list(mainPids),
			posts.attachments.get(mainPids),
		]);

		// Add uploaded media to thumb sets
		mainPidUploads.forEach((uploads, idx) => {
			uploads = uploads.filter((upload) => {
				const type = mime.getType(upload);
				return !thumbs[idx].includes(upload) && type && type.startsWith('image/');
			});

			if (uploads.length) {
				thumbs[idx].push(...uploads);
			}
		});

		// Add attachments to thumb sets
		mainPidAttachments.forEach((attachments, idx) => {
			attachments = attachments.filter(
				attachment => !thumbs[idx].includes(attachment.url) && (attachment.mediaType && attachment.mediaType.startsWith('image/'))
			);

			if (attachments.length) {
				thumbs[idx].push(...attachments.map(attachment => attachment.url));
			}
		});
	}

	const hasTimestampPrefix = /^\d+-/;

	let response = thumbs.map((thumbSet, idx) => thumbSet.map(thumb => ({
		id: String(tids[idx]),
		name: (() => {
			const name = path.basename(thumb);
			return hasTimestampPrefix.test(name) ? name.slice(14) : name;
		})(),
		path: thumb,
		url: thumb.startsWith('http') ?
			thumb :
			path.posix.join(upload_url, thumb.replace(/\\/g, '/')),
	})));

	({ thumbs: response } = await plugins.hooks.fire('filter:topics.getThumbs', {
		tids,
		thumbsOnly: options.thumbsOnly,
		thumbs: response,
	}));
	return response;
};

Thumbs.get = async function (tids, options) {
	// Allow singular or plural usage
	let singular = false;
	if (!Array.isArray(tids)) {
		tids = [tids];
		singular = true;
	}

	if (!options) {
		options = {
			thumbsOnly: false,
		};
	}
	if (!meta.config.allowTopicsThumbnail || !tids.length) {
		return singular ? [] : tids.map(() => []);
	}

	const topicData = await topics.getTopicsFields(tids, ['tid', 'mainPid', 'thumbs']);
	const response = await loadFromTopicData(topicData, options);
	return singular ? response[0] : response;
};


Thumbs.associate = async function ({ id, path, score }) {
	// Associates a newly uploaded file as a thumb to the passed-in topic
	const topicData = await topics.getTopicData(id);
	if (!topicData) {
		return;
	}
	const isLocal = !path.startsWith('http');

	// Normalize the path to allow for changes in upload_path (and so upload_url can be appended if needed)
	if (isLocal) {
		path = path.replace(nconf.get('relative_path'), '');
		path = path.replace(nconf.get('upload_url'), '');
	}

	if (Array.isArray(topicData.thumbs)) {
		const currentIdx = topicData.thumbs.indexOf(path);
		const insertIndex = (typeof score === 'number' && score >= 0 && score < topicData.thumbs.length) ?
			score :
			topicData.thumbs.length;

		if (currentIdx !== -1) {
			// Remove from current position
			topicData.thumbs.splice(currentIdx, 1);
			// Adjust insertIndex if needed
			const adjustedIndex = currentIdx < insertIndex ? insertIndex - 1 : insertIndex;
			topicData.thumbs.splice(adjustedIndex, 0, path);
		} else {
			topicData.thumbs.splice(insertIndex, 0, path);
		}

		await topics.setTopicFields(id, {
			thumbs: JSON.stringify(topicData.thumbs),
			numThumbs: topicData.thumbs.length,
		});
		// Associate thumbnails with the main pid (only on local upload)
		if (isLocal && currentIdx === -1) {
			await posts.uploads.associate(topicData.mainPid, path);
		}
	}
};

Thumbs.filterThumbs = function (thumbs) {
	if (!Array.isArray(thumbs)) {
		return [];
	}
	thumbs = thumbs.filter((thumb) => {
		if (thumb.startsWith('http')) {
			return true;
		}
		// ensure it is in upload path
		const fullPath = path.join(upload_path, thumb);
		return fullPath.startsWith(upload_path);
	});
	return thumbs;
};

Thumbs.delete = async function (tid, relativePaths) {
	const topicData = await topics.getTopicData(tid);
	if (!topicData) {
		return;
	}

	if (typeof relativePaths === 'string') {
		relativePaths = [relativePaths];
	} else if (!Array.isArray(relativePaths)) {
		throw new Error('[[error:invalid-data]]');
	}

	const toRemove = relativePaths.map(
		relativePath => topicData.thumbs.includes(relativePath) ? relativePath : null
	).filter(Boolean);


	if (toRemove.length) {
		const { mainPid } = topicData.mainPid;
		topicData.thumbs = topicData.thumbs.filter(thumb => !toRemove.includes(thumb));
		await Promise.all([
			topics.setTopicFields(tid, {
				thumbs: JSON.stringify(topicData.thumbs),
				numThumbs: topicData.thumbs.length,
			}),
			Promise.all(toRemove.map(async relativePath => posts.uploads.dissociate(mainPid, relativePath))),
		]);
	}
};

Thumbs.deleteAll = async (tid) => {
	const topicData = await topics.getTopicData(tid);
	if (!topicData) {
		return;
	}
	await Thumbs.delete(tid, topicData.thumbs);
};
