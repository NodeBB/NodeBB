
'use strict';

const async = require('async');

const db = require('../database');
const posts = require('../posts');
const categories = require('../categories');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');

module.exports = function (Topics) {
	Topics.createTopicFromPosts = async function (uid, title, pids, fromTid) {
		if (title) {
			title = title.trim();
		}

		if (title.length < meta.config.minimumTitleLength) {
			throw new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
		} else if (title.length > meta.config.maximumTitleLength) {
			throw new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
		}

		if (!pids || !pids.length) {
			throw new Error('[[error:invalid-pid]]');
		}

		pids.sort((a, b) => a - b);

		const mainPid = pids[0];
		const cid = await posts.getCidByPid(mainPid);

		const [postData, isAdminOrMod] = await Promise.all([
			posts.getPostData(mainPid),
			privileges.categories.isAdminOrMod(cid, uid),
		]);

		if (!isAdminOrMod) {
			throw new Error('[[error:no-privileges]]');
		}
		const tid = await Topics.create({ uid: postData.uid, title: title, cid: cid });
		await Topics.updateTopicBookmarks(fromTid, pids);

		await async.eachSeries(pids, async function (pid) {
			const canEdit = await privileges.posts.canEdit(pid, uid);
			if (!canEdit.flag) {
				throw new Error(canEdit.message);
			}
			await Topics.movePostToTopic(uid, pid, tid);
		});

		await Topics.updateLastPostTime(tid, Date.now());

		await Promise.all([
			Topics.setTopicFields(tid, {
				upvotes: postData.upvotes,
				downvotes: postData.downvotes,
			}),
			db.sortedSetsAdd(['topics:votes', 'cid:' + cid + ':tids:votes'], postData.votes, tid),
		]);

		plugins.hooks.fire('action:topic.fork', { tid: tid, fromTid: fromTid, uid: uid });

		return await Topics.getTopicData(tid);
	};

	Topics.movePostToTopic = async function (callerUid, pid, tid) {
		tid = parseInt(tid, 10);
		const exists = await Topics.exists(tid);
		if (!exists) {
			throw new Error('[[error:no-topic]]');
		}
		const postData = await posts.getPostFields(pid, ['tid', 'uid', 'timestamp', 'upvotes', 'downvotes']);
		if (!postData || !postData.tid) {
			throw new Error('[[error:no-post]]');
		}

		if (postData.tid === tid) {
			throw new Error('[[error:cant-move-to-same-topic]]');
		}

		postData.pid = pid;

		await Topics.removePostFromTopic(postData.tid, postData);
		await Promise.all([
			updateCategory(postData, tid),
			posts.setPostField(pid, 'tid', tid),
			Topics.addPostToTopic(tid, postData),
		]);

		await Promise.all([
			Topics.updateLastPostTimeFromLastPid(tid),
			Topics.updateLastPostTimeFromLastPid(postData.tid),
		]);
		plugins.hooks.fire('action:post.move', { uid: callerUid, post: postData, tid: tid });
	};

	async function updateCategory(postData, toTid) {
		const topicData = await Topics.getTopicsFields([postData.tid, toTid], ['cid', 'pinned']);

		if (!topicData[0].cid || !topicData[1].cid) {
			return;
		}

		if (!topicData[0].pinned) {
			await db.sortedSetIncrBy('cid:' + topicData[0].cid + ':tids:posts', -1, postData.tid);
		}
		if (!topicData[1].pinned) {
			await db.sortedSetIncrBy('cid:' + topicData[1].cid + ':tids:posts', 1, toTid);
		}
		if (topicData[0].cid === topicData[1].cid) {
			await categories.updateRecentTidForCid(topicData[0].cid);
			return;
		}
		const removeFrom = [
			'cid:' + topicData[0].cid + ':pids',
			'cid:' + topicData[0].cid + ':uid:' + postData.uid + ':pids',
			'cid:' + topicData[0].cid + ':uid:' + postData.uid + ':pids:votes',
		];
		const tasks = [
			db.incrObjectFieldBy('category:' + topicData[0].cid, 'post_count', -1),
			db.incrObjectFieldBy('category:' + topicData[1].cid, 'post_count', 1),
			db.sortedSetRemove(removeFrom, postData.pid),
			db.sortedSetAdd('cid:' + topicData[1].cid + ':pids', postData.timestamp, postData.pid),
			db.sortedSetAdd('cid:' + topicData[1].cid + ':uid:' + postData.uid + ':pids', postData.timestamp, postData.pid),
		];
		if (postData.votes > 0) {
			tasks.push(db.sortedSetAdd('cid:' + topicData[1].cid + ':uid:' + postData.uid + ':pids:votes', postData.votes, postData.pid));
		}

		await Promise.all(tasks);
		await Promise.all([
			categories.updateRecentTidForCid(topicData[0].cid),
			categories.updateRecentTidForCid(topicData[1].cid),
		]);
	}
};
