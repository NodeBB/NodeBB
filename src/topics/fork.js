
'use strict';

const db = require('../database');
const posts = require('../posts');
const categories = require('../categories');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');
const activitypub = require('../activitypub');
const utils = require('../utils');

module.exports = function (Topics) {
	Topics.createTopicFromPosts = async function (uid, title, pids, fromTid, cid) {
		if (title) {
			title = title.trim();
		}

		if (title.length < meta.config.minimumTitleLength) {
			throw new Error(`[[error:title-too-short, ${meta.config.minimumTitleLength}]]`);
		} else if (title.length > meta.config.maximumTitleLength) {
			throw new Error(`[[error:title-too-long, ${meta.config.maximumTitleLength}]]`);
		}

		if (!pids || !pids.length) {
			throw new Error('[[error:invalid-pid]]');
		}

		if (pids.every(isFinite)) {
			pids.sort((a, b) => a - b);
		} else {
			const pidsDatetime = (await db.sortedSetScores(`tid:${fromTid}:posts`, pids)).map(t => t || 0);
			const map = pids.reduce((map, pid, idx) => map.set(pidsDatetime[idx], pid), new Map());
			pidsDatetime.sort((a, b) => a - b);
			pids = pidsDatetime.map(key => map.get(key));
		}

		const mainPid = pids[0];
		if (!cid) {
			cid = await posts.getCidByPid(mainPid);
		}

		const [mainPost, isAdminOrMod] = await Promise.all([
			posts.getPostData(mainPid),
			privileges.categories.isAdminOrMod(cid, uid),
		]);
		let lastPost = mainPost;
		if (pids.length > 1) {
			lastPost = await posts.getPostData(pids[pids.length - 1]);
		}

		if (!isAdminOrMod) {
			throw new Error('[[error:no-privileges]]');
		}
		const now = Date.now();
		const scheduled = mainPost.timestamp > now;
		const params = {
			uid: mainPost.uid,
			title: title,
			cid: cid,
			timestamp: mainPost.timestamp,
		};
		const result = await plugins.hooks.fire('filter:topic.fork', {
			params: params,
			tid: mainPost.tid,
		});

		const tid = await Topics.create(result.params);
		await Topics.updateTopicBookmarks(fromTid, pids);

		for (const pid of pids) {
			/* eslint-disable no-await-in-loop */
			const canEdit = await privileges.posts.canEdit(pid, uid);
			if (!canEdit.flag) {
				throw new Error(canEdit.message);
			}
			await Topics.movePostToTopic(uid, pid, tid, scheduled);
		}

		await Topics.updateLastPostTime(tid, scheduled ? (mainPost.timestamp + 1) : lastPost.timestamp);

		await Promise.all([
			Topics.setTopicFields(tid, {
				upvotes: mainPost.upvotes,
				downvotes: mainPost.downvotes,
				forkedFromTid: fromTid,
				forkerUid: uid,
				forkTimestamp: now,
			}),
			db.sortedSetsAdd(['topics:votes', `cid:${cid}:tids:votes`], mainPost.votes, tid),
			Topics.events.log(fromTid, { type: 'fork', uid, href: `/topic/${tid}` }),
		]);

		// ideally we should federate a "move" activity instead, then can capture remote posts too. tbd
		if (utils.isNumber(pids[0])) {
			const { activity } = await activitypub.mocks.activities.create(pids[0], uid);
			await activitypub.feps.announce(pids[0], activity);
		}

		plugins.hooks.fire('action:topic.fork', { tid, fromTid, uid });

		return await Topics.getTopicData(tid);
	};

	Topics.movePostToTopic = async function (callerUid, pid, tid, forceScheduled = false) {
		tid = String(tid);
		const topicData = await Topics.getTopicFields(tid, ['tid', 'scheduled']);
		if (!topicData.tid) {
			throw new Error('[[error:no-topic]]');
		}
		if (!forceScheduled && topicData.scheduled) {
			throw new Error('[[error:cant-move-posts-to-scheduled]]');
		}
		const postData = await posts.getPostFields(pid, ['tid', 'uid', 'timestamp', 'upvotes', 'downvotes']);
		if (!postData || !postData.tid) {
			throw new Error('[[error:no-post]]');
		}

		const isSourceTopicScheduled = await Topics.getTopicField(postData.tid, 'scheduled');
		if (!forceScheduled && isSourceTopicScheduled) {
			throw new Error('[[error:cant-move-from-scheduled-to-existing]]');
		}

		if (String(postData.tid) === String(tid)) {
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
			await db.sortedSetIncrBy(`cid:${topicData[0].cid}:tids:posts`, -1, postData.tid);
		}
		if (!topicData[1].pinned) {
			await db.sortedSetIncrBy(`cid:${topicData[1].cid}:tids:posts`, 1, toTid);
		}
		if (topicData[0].cid === topicData[1].cid) {
			await categories.updateRecentTidForCid(topicData[0].cid);
			return;
		}
		const removeFrom = [
			`cid:${topicData[0].cid}:pids`,
			`cid:${topicData[0].cid}:uid:${postData.uid}:pids`,
			`cid:${topicData[0].cid}:uid:${postData.uid}:pids:votes`,
		];
		const tasks = [
			db.incrObjectFieldBy(`category:${topicData[0].cid}`, 'post_count', -1),
			db.incrObjectFieldBy(`category:${topicData[1].cid}`, 'post_count', 1),
			db.sortedSetRemove(removeFrom, postData.pid),
			db.sortedSetAdd(`cid:${topicData[1].cid}:pids`, postData.timestamp, postData.pid),
			db.sortedSetAdd(`cid:${topicData[1].cid}:uid:${postData.uid}:pids`, postData.timestamp, postData.pid),
		];
		if (postData.votes > 0 || postData.votes < 0) {
			tasks.push(db.sortedSetAdd(`cid:${topicData[1].cid}:uid:${postData.uid}:pids:votes`, postData.votes, postData.pid));
		}

		await Promise.all(tasks);
		await Promise.all([
			categories.updateRecentTidForCid(topicData[0].cid),
			categories.updateRecentTidForCid(topicData[1].cid),
		]);
	}
};
