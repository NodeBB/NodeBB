'use strict';

const validator = require('validator');
const diff = require('diff');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const translator = require('../translator');
const topics = require('../topics');

module.exports = function (Posts) {
	const Diffs = {};
	Posts.diffs = Diffs;
	Diffs.exists = async function (pid) {
		if (meta.config.enablePostHistory !== 1) {
			return false;
		}

		const numDiffs = await db.listLength(`post:${pid}:diffs`);
		return !!numDiffs;
	};

	Diffs.get = async function (pid, since) {
		const timestamps = await Diffs.list(pid);
		if (!since) {
			since = 0;
		}

		// Pass those made after `since`, and create keys
		const keys = timestamps.filter(t => (parseInt(t, 10) || 0) > since)
			.map(t => `diff:${pid}.${t}`);
		return await db.getObjects(keys);
	};

	Diffs.list = async function (pid) {
		return await db.getListRange(`post:${pid}:diffs`, 0, -1);
	};

	Diffs.save = async function (data) {
		const { pid, uid, oldContent, newContent, edited, topic } = data;
		const editTimestamp = edited || Date.now();
		const diffData = {
			uid: uid,
			pid: pid,
		};
		if (oldContent !== newContent) {
			diffData.patch = diff.createPatch('', newContent, oldContent);
		}
		if (topic.renamed) {
			diffData.title = topic.oldTitle;
		}
		if (topic.tagsupdated && Array.isArray(topic.oldTags)) {
			diffData.tags = topic.oldTags.map(tag => tag && tag.value).filter(Boolean).join(',');
		}
		await Promise.all([
			db.listPrepend(`post:${pid}:diffs`, editTimestamp),
			db.setObject(`diff:${pid}.${editTimestamp}`, diffData),
		]);
	};

	Diffs.load = async function (pid, since, uid) {
		since = getValidatedTimestamp(since);
		const post = await postDiffLoad(pid, since, uid);
		post.content = String(post.content || '');

		const result = await plugins.hooks.fire('filter:parse.post', { postData: post });
		result.postData.content = translator.escape(result.postData.content);
		return result.postData;
	};

	Diffs.restore = async function (pid, since, uid, req) {
		since = getValidatedTimestamp(since);
		const post = await postDiffLoad(pid, since, uid);

		return await Posts.edit({
			uid: uid,
			pid: pid,
			content: post.content,
			req: req,
			timestamp: since,
			title: post.topic.title,
			tags: post.topic.tags.map(tag => tag.value),
		});
	};

	Diffs.delete = async function (pid, timestamp, uid) {
		getValidatedTimestamp(timestamp);

		const [post, diffs, timestamps] = await Promise.all([
			Posts.getPostSummaryByPids([pid], uid, { parse: false }),
			Diffs.get(pid),
			Diffs.list(pid),
		]);

		const timestampIndex = timestamps.indexOf(timestamp);
		const lastTimestampIndex = timestamps.length - 1;

		if (timestamp === String(post[0].timestamp)) {
			// Deleting oldest diff, so history rewrite is not needed
			return Promise.all([
				db.delete(`diff:${pid}.${timestamps[lastTimestampIndex]}`),
				db.listRemoveAll(`post:${pid}:diffs`, timestamps[lastTimestampIndex]),
			]);
		}
		if (timestampIndex === 0 || timestampIndex === -1) {
			throw new Error('[[error:invalid-data]]');
		}

		const postContent = validator.unescape(post[0].content);
		const versionContents = {};
		for (let i = 0, content = postContent; i < timestamps.length; ++i) {
			versionContents[timestamps[i]] = applyPatch(content, diffs[i]);
			content = versionContents[timestamps[i]];
		}

		/* eslint-disable no-await-in-loop */
		for (let i = lastTimestampIndex; i >= timestampIndex; --i) {
			// Recreate older diffs with skipping the deleted diff
			const newContentIndex = i === timestampIndex ? i - 2 : i - 1;
			const timestampToUpdate = newContentIndex + 1;
			const newContent = newContentIndex < 0 ? postContent : versionContents[timestamps[newContentIndex]];
			const patch = diff.createPatch('', newContent, versionContents[timestamps[i]]);
			await db.setObject(`diff:${pid}.${timestamps[timestampToUpdate]}`, { patch });
		}

		return Promise.all([
			db.delete(`diff:${pid}.${timestamp}`),
			db.listRemoveAll(`post:${pid}:diffs`, timestamp),
		]);
	};

	async function postDiffLoad(pid, since, uid) {
		// Retrieves all diffs made since `since` and replays them to reconstruct what the post looked like at `since`
		const [post, diffs] = await Promise.all([
			Posts.getPostSummaryByPids([pid], uid, { parse: false }),
			Posts.diffs.get(pid, since),
		]);

		// Replace content with re-constructed content from that point in time
		post[0].content = diffs.reduce(applyPatch, validator.unescape(post[0].content));

		const titleDiffs = diffs.filter(d => d.hasOwnProperty('title') && d.title);
		if (titleDiffs.length && post[0].topic) {
			post[0].topic.title = validator.unescape(String(titleDiffs[titleDiffs.length - 1].title));
		}
		const tagDiffs = diffs.filter(d => d.hasOwnProperty('tags') && d.tags);
		if (tagDiffs.length && post[0].topic) {
			const tags = tagDiffs[tagDiffs.length - 1].tags.split(',').map(tag => ({ value: tag }));
			post[0].topic.tags = topics.getTagData(tags);
		}

		return post[0];
	}

	function getValidatedTimestamp(timestamp) {
		timestamp = parseInt(timestamp, 10);

		if (isNaN(timestamp)) {
			throw new Error('[[error:invalid-data]]');
		}

		return timestamp;
	}

	function applyPatch(content, aDiff) {
		if (aDiff && aDiff.patch) {
			const result = diff.applyPatch(content, aDiff.patch, {
				fuzzFactor: 1,
			});
			return typeof result === 'string' ? result : content;
		}
		return content;
	}
};
