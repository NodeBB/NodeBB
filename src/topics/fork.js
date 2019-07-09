
'use strict';

var async = require('async');

var db = require('../database');
var posts = require('../posts');
var privileges = require('../privileges');
var plugins = require('../plugins');
var meta = require('../meta');

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

		var mainPid = pids[0];
		var cid = await posts.getCidByPid(mainPid);

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

		plugins.fireHook('action:topic.fork', { tid: tid, fromTid: fromTid, uid: uid });

		return await Topics.getTopicData(tid);
	};

	Topics.movePostToTopic = async function (callerUid, pid, tid) {
		var postData;
		tid = parseInt(tid, 10);
		const exists = await Topics.exists(tid);
		if (!exists) {
			throw new Error('[[error:no-topic]]');
		}
		const post = await posts.getPostFields(pid, ['tid', 'uid', 'timestamp', 'upvotes', 'downvotes']);
		if (!post || !post.tid) {
			throw new Error('[[error:no-post]]');
		}

		if (post.tid === tid) {
			throw new Error('[[error:cant-move-to-same-topic]]');
		}

		postData = post;
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
		plugins.fireHook('action:post.move', { uid: callerUid, post: postData, tid: tid });
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
	}
};
