'use strict';

const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');
const categories = require('../categories');
const user = require('../user');
const notifications = require('../notifications');
const plugins = require('../plugins');
const flags = require('../flags');

module.exports = function (Posts) {
	Posts.delete = async function (pid, uid) {
		return await deleteOrRestore('delete', pid, uid);
	};

	Posts.restore = async function (pid, uid) {
		return await deleteOrRestore('restore', pid, uid);
	};

	async function deleteOrRestore(type, pid, uid) {
		const isDeleting = type === 'delete';
		await plugins.hooks.fire(`filter:post.${type}`, { pid: pid, uid: uid });
		await Posts.setPostFields(pid, {
			deleted: isDeleting ? 1 : 0,
			deleterUid: isDeleting ? uid : 0,
		});
		const postData = await Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp']);
		const topicData = await topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned']);
		postData.cid = topicData.cid;
		await Promise.all([
			topics.updateLastPostTimeFromLastPid(postData.tid),
			topics.updateTeaser(postData.tid),
			isDeleting ?
				db.sortedSetRemove(`cid:${topicData.cid}:pids`, pid) :
				db.sortedSetAdd(`cid:${topicData.cid}:pids`, postData.timestamp, pid),
		]);
		await categories.updateRecentTidForCid(postData.cid);
		plugins.hooks.fire(`action:post.${type}`, { post: _.clone(postData), uid: uid });
		if (type === 'delete') {
			await flags.resolveFlag('post', pid, uid);
		}
		return postData;
	}

	Posts.purge = async function (pids, uid) {
		pids = Array.isArray(pids) ? pids : [pids];
		let postData = await Posts.getPostsData(pids);
		pids = pids.filter((pid, index) => !!postData[index]);
		postData = postData.filter(Boolean);
		if (!postData.length) {
			return;
		}
		const uniqTids = _.uniq(postData.map(p => p.tid));
		const topicData = await topics.getTopicsFields(uniqTids, ['tid', 'cid', 'pinned']);
		const tidToTopic = _.zipObject(uniqTids, topicData);

		postData.forEach((p) => {
			p.cid = tidToTopic[p.tid] && tidToTopic[p.tid].cid;
		});

		// deprecated hook
		await Promise.all(postData.map(p => plugins.hooks.fire('filter:post.purge', { post: p, pid: p.pid, uid: uid })));

		// new hook
		await plugins.hooks.fire('filter:posts.purge', {
			posts: postData,
			pids: postData.map(p => p.pid),
			uid: uid,
		});

		await Promise.all([
			deleteFromTopicUserNotification(postData, topicData),
			deleteFromCategoryRecentPosts(postData),
			deleteFromUsersBookmarks(pids),
			deleteFromUsersVotes(pids),
			deleteFromReplies(postData),
			deleteFromGroups(pids),
			deleteDiffs(pids),
			deleteFromUploads(pids),
			db.sortedSetsRemove(['posts:pid', 'posts:votes', 'posts:flagged'], pids),
		]);

		await resolveFlags(postData, uid);

		// deprecated hook
		Promise.all(postData.map(p => plugins.hooks.fire('action:post.purge', { post: p, uid: uid })));

		// new hook
		plugins.hooks.fire('action:posts.purge', { posts: postData, uid: uid });

		await db.deleteAll(postData.map(p => `post:${p.pid}`));
	};

	async function deleteFromTopicUserNotification(postData, topicData) {
		await db.sortedSetsRemove([
			`tid:${postData.tid}:posts`,
			`tid:${postData.tid}:posts:votes`,
			`uid:${postData.uid}:posts`,
		], postData.pid);

		const tasks = [
			db.decrObjectField('global', 'postCount'),
			db.decrObjectField(`category:${topicData.cid}`, 'post_count'),
			db.sortedSetRemove(`cid:${topicData.cid}:uid:${postData.uid}:pids`, postData.pid),
			db.sortedSetRemove(`cid:${topicData.cid}:uid:${postData.uid}:pids:votes`, postData.pid),
			topics.decreasePostCount(postData.tid),
			topics.updateTeaser(postData.tid),
			topics.updateLastPostTimeFromLastPid(postData.tid),
			db.sortedSetIncrBy(`tid:${postData.tid}:posters`, -1, postData.uid),
			user.updatePostCount(postData.uid),
			notifications.rescind(`new_post:tid:${postData.tid}:pid:${postData.pid}:uid:${postData.uid}`),
		];

		if (!topicData.pinned) {
			tasks.push(db.sortedSetIncrBy(`cid:${topicData.cid}:tids:posts`, -1, postData.tid));
		}
		await Promise.all(tasks);
	}

	async function deleteFromCategoryRecentPosts(postData) {
		const uniqCids = _.uniq(postData.map(p => p.cid));
		const sets = uniqCids.map(cid => `cid:${cid}:pids`);
		await db.sortedSetRemove(sets, postData.map(p => p.pid));
		await Promise.all(uniqCids.map(categories.updateRecentTidForCid));
	}

	async function deleteFromUsersBookmarks(pids) {
		const arrayOfUids = await db.getSetsMembers(pids.map(pid => `pid:${pid}:users_bookmarked`));
		const bulkRemove = [];
		pids.forEach((pid, index) => {
			arrayOfUids[index].forEach((uid) => {
				bulkRemove.push([`uid:${uid}:bookmarks`, pid]);
			});
		});
		await db.sortedSetRemoveBulk(bulkRemove);
		await db.deleteAll(pids.map(pid => `pid:${pid}:users_bookmarked`));
	}

	async function deleteFromUsersVotes(pids) {
		const [upvoters, downvoters] = await Promise.all([
			db.getSetsMembers(pids.map(pid => `pid:${pid}:upvote`)),
			db.getSetsMembers(pids.map(pid => `pid:${pid}:downvote`)),
		]);
		const bulkRemove = [];
		pids.forEach((pid, index) => {
			upvoters[index].forEach((upvoterUid) => {
				bulkRemove.push([`uid:${upvoterUid}:upvote`, pid]);
			});
			downvoters[index].forEach((downvoterUid) => {
				bulkRemove.push([`uid:${downvoterUid}:downvote`, pid]);
			});
		});

		await Promise.all([
			db.sortedSetRemoveBulk(bulkRemove),
			db.deleteAll([
				...pids.map(pid => `pid:${pid}:upvote`),
				...pids.map(pid => `pid:${pid}:downvote`),
			]),
		]);
	}

	async function deleteFromReplies(postData) {
		const arrayOfReplyPids = await db.getSortedSetsMembers(postData.map(p => `pid:${p.pid}:replies`));
		const allReplyPids = _.flatten(arrayOfReplyPids);
		const promises = [
			db.deleteObjectFields(
				allReplyPids.map(pid => `post:${pid}`), ['toPid']
			),
			db.deleteAll(postData.map(p => `pid:${p.pid}:replies`)),
		];

		const postsWithParents = postData.filter(p => parseInt(p.toPid, 10));
		const bulkRemove = postsWithParents.map(p => [`pid:${p.toPid}:replies`, p.pid]);
		promises.push(db.sortedSetRemoveBulk(bulkRemove));
		await Promise.all(promises);

		const parentPids = _.uniq(postsWithParents.map(p => p.toPid));
		const counts = db.sortedSetsCard(parentPids.map(pid => `pid:${pid}:replies`));
		await db.setObjectBulk(parentPids.map((pid, index) => [`post:${pid}`, { replies: counts[index] }]));
	}

	async function deleteFromGroups(pids) {
		const groupNames = await db.getSortedSetMembers('groups:visible:createtime');
		const keys = groupNames.map(groupName => `group:${groupName}:member:pids`);
		await db.sortedSetRemove(keys, pids);
	}

	async function deleteDiffs(pids) {
		const timestamps = await Promise.all(pids.map(pid => Posts.diffs.list(pid)));
		await db.deleteAll([
			...pids.map(pid => `post:${pid}:diffs`),
			..._.flattenDeep(pids.map((pid, index) => timestamps[index].map(t => `diff:${pid}.${t}`))),
		]);
	}

	async function deleteFromUploads(pids) {
		await Promise.all(pids.map(Posts.uploads.dissociateAll));
	}

	async function resolveFlags(postData, uid) {
		const flaggedPosts = postData.filter(p => parseInt(p.flagId, 10));
		await Promise.all(flaggedPosts.map(p => flags.update(p.flagId, uid, { state: 'resolved' })));
	}
};
