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
		// Pass those made after `since`, and create keys
		const keys = timestamps.filter(t => (parseInt(t, 10) || 0) >= since)
			.map(t => 'diff:' + pid + '.' + t);
		return await db.getObjects(keys);
	};

	Diffs.list = async function (pid) {
		return await db.getListRange('post:' + pid + ':diffs', 0, -1);
	};

	Diffs.save = async function (pid, oldContent, newContent) {
		const now = Date.now();
		const patch = diff.createPatch('', newContent, oldContent);
		await Promise.all([
			db.listPrepend('post:' + pid + ':diffs', now),
			db.setObject('diff:' + pid + '.' + now, {
				pid: pid,
				patch: patch,
			}),
		]);
	};

	Diffs.load = async function (pid, since, uid) {
		// Retrieves all diffs made since `since` and replays them to reconstruct what the post looked like at `since`
		since = parseInt(since, 10);

		if (isNaN(since) || since > Date.now()) {
			throw new Error('[[error:invalid-data]]');
		}

		const [post, diffs] = await Promise.all([
			Posts.getPostSummaryByPids([pid], uid, { parse: false }),
			Posts.diffs.get(pid, since),
		]);
		const data = {
			post: post,
			diffs: diffs,
		};
		postDiffLoad(data);
		const result = await plugins.fireHook('filter:parse.post', { postData: data.post });
		result.postData.content = translator.escape(result.postData.content);
		return result.postData;
	};

	function postDiffLoad(data) {
		data.post = data.post[0];
		data.post.content = validator.unescape(data.post.content);

		// Replace content with re-constructed content from that point in time
		data.post.content = data.diffs.reduce(function (content, currentDiff) {
			const result = diff.applyPatch(content, currentDiff.patch, {
				fuzzFactor: 1,
			});

			return typeof result === 'string' ? result : content;
		}, data.post.content);

		// Clear editor data (as it is outdated for this content)
		delete data.post.edited;
		data.post.editor = null;

		data.post.content = String(data.post.content || '');
	}
};
