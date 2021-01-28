'use strict';

const validator = require('validator');
const diff = require('diff');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const translator = require('../translator');


module.exports = function (Posts) {
	const Diffs = {};
	Posts.diffs = Diffs;
	Diffs.exists = async function (pid) {
		if (meta.config.enablePostHistory !== 1) {
			return false;
		}

		const numDiffs = await db.listLength('post:' + pid + ':diffs');
		return !!numDiffs;
	};

	Diffs.get = async function (pid, since) {
		const timestamps = await Diffs.list(pid);
		if (!since) {
			since = 0;
		}

		// Pass those made after `since`, and create keys
		const keys = timestamps.filter(t => (parseInt(t, 10) || 0) > since)
			.map(t => 'diff:' + pid + '.' + t);
		return await db.getObjects(keys);
	};

	Diffs.list = async function (pid) {
		return await db.getListRange('post:' + pid + ':diffs', 0, -1);
	};

	Diffs.save = async function (data) {
		const { pid, uid, oldContent, newContent } = data;
		const now = Date.now();
		const patch = diff.createPatch('', newContent, oldContent);
		await Promise.all([
			db.listPrepend('post:' + pid + ':diffs', now),
			db.setObject('diff:' + pid + '.' + now, {
				uid: uid,
				pid: pid,
				patch: patch,
			}),
		]);
	};

	Diffs.load = async function (pid, since, uid) {
		const post = await postDiffLoad(pid, since, uid);
		post.content = String(post.content || '');

		const result = await plugins.hooks.fire('filter:parse.post', { postData: post });
		result.postData.content = translator.escape(result.postData.content);
		return result.postData;
	};

	Diffs.restore = async function (pid, since, uid, req) {
		const post = await postDiffLoad(pid, since, uid);

		return await Posts.edit({
			uid: uid,
			pid: pid,
			content: post.content,
			req: req,
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
			const newContentIndex = i === timestampIndex ? i - 2 : i - 1;
			const timestampToUpdate = newContentIndex + 1;
			const newContent = newContentIndex < 0 ? postContent : versionContents[timestamps[newContentIndex]];
			const patch = diff.createPatch('', newContent, versionContents[timestamps[i]]);
			await db.setObject('diff:' + pid + '.' + timestamps[timestampToUpdate], { patch });
		}

		return Promise.all([
			db.delete(`diff:${pid}.${timestamp}`),
			db.listRemoveAll(`post:${pid}:diffs`, timestamp),
		]);
	};

	async function postDiffLoad(pid, since, uid) {
		// Retrieves all diffs made since `since` and replays them to reconstruct what the post looked like at `since`
		since = getValidatedTimestamp(since);

		const [post, diffs] = await Promise.all([
			Posts.getPostSummaryByPids([pid], uid, { parse: false }),
			Posts.diffs.get(pid, since),
		]);

		// Replace content with re-constructed content from that point in time
		post[0].content = diffs.reduce(applyPatch, validator.unescape(post[0].content));

		return post[0];
	}

	function getValidatedTimestamp(timestamp) {
		timestamp = parseInt(timestamp, 10);

		if (isNaN(timestamp) || timestamp > Date.now()) {
			throw new Error('[[error:invalid-data]]');
		}

		return timestamp;
	}

	function applyPatch(content, aDiff) {
		const result = diff.applyPatch(content, aDiff.patch, {
			fuzzFactor: 1,
		});
		return typeof result === 'string' ? result : content;
	}
};
