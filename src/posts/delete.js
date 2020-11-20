'use strict';

const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');
const categories = require('../categories');
const user = require('../user');
const groups = require('../groups');
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
		await plugins.hooks.fire('filter:post.' + type, { pid: pid, uid: uid });
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
				db.sortedSetRemove('cid:' + topicData.cid + ':pids', pid) :
				db.sortedSetAdd('cid:' + topicData.cid + ':pids', postData.timestamp, pid),
		]);
		await categories.updateRecentTidForCid(postData.cid);
		plugins.hooks.fire('action:post.' + type, { post: _.clone(postData), uid: uid });
		if (type === 'delete') {
			await flags.resolveFlag('post', pid, uid);
		}
		return postData;
	}

	Posts.purge = async function (pid, uid) {
		const postData = await Posts.getPostData(pid);
		if (!postData) {
			return;
		}
		const topicData = await topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned']);
		postData.cid = topicData.cid;
		await plugins.hooks.fire('filter:post.purge', { post: postData, pid: pid, uid: uid });
		await Promise.all([
			deletePostFromTopicUserNotification(postData, topicData),
			deletePostFromCategoryRecentPosts(postData),
			deletePostFromUsersBookmarks(pid),
			deletePostFromUsersVotes(pid),
			deletePostFromReplies(postData),
			deletePostFromGroups(postData),
			db.sortedSetsRemove(['posts:pid', 'posts:votes', 'posts:flagged'], pid),
			Posts.uploads.dissociateAll(pid),
		]);
		await flags.resolveFlag('post', pid, uid);
		plugins.hooks.fire('action:post.purge', { post: postData, uid: uid });
		await db.delete('post:' + pid);
	};

	async function deletePostFromTopicUserNotification(postData, topicData) {
		await db.sortedSetsRemove([
			'tid:' + postData.tid + ':posts',
			'tid:' + postData.tid + ':posts:votes',
			'uid:' + postData.uid + ':posts',
		], postData.pid);

		const tasks = [
			db.decrObjectField('global', 'postCount'),
			db.decrObjectField('category:' + topicData.cid, 'post_count'),
			db.sortedSetRemove('cid:' + topicData.cid + ':uid:' + postData.uid + ':pids', postData.pid),
			db.sortedSetRemove('cid:' + topicData.cid + ':uid:' + postData.uid + ':pids:votes', postData.pid),
			topics.decreasePostCount(postData.tid),
			topics.updateTeaser(postData.tid),
			topics.updateLastPostTimeFromLastPid(postData.tid),
			db.sortedSetIncrBy('tid:' + postData.tid + ':posters', -1, postData.uid),
			user.incrementUserPostCountBy(postData.uid, -1),
			notifications.rescind('new_post:tid:' + postData.tid + ':pid:' + postData.pid + ':uid:' + postData.uid),
		];

		if (!topicData.pinned) {
			tasks.push(db.sortedSetIncrBy('cid:' + topicData.cid + ':tids:posts', -1, postData.tid));
		}
		await Promise.all(tasks);
	}

	async function deletePostFromCategoryRecentPosts(postData) {
		const cids = await categories.getAllCidsFromSet('categories:cid');
		const sets = cids.map(cid => 'cid:' + cid + ':pids');
		await db.sortedSetsRemove(sets, postData.pid);
		await categories.updateRecentTidForCid(postData.cid);
	}

	async function deletePostFromUsersBookmarks(pid) {
		const uids = await db.getSetMembers('pid:' + pid + ':users_bookmarked');
		const sets = uids.map(uid => 'uid:' + uid + ':bookmarks');
		await db.sortedSetsRemove(sets, pid);
		await db.delete('pid:' + pid + ':users_bookmarked');
	}

	async function deletePostFromUsersVotes(pid) {
		const [upvoters, downvoters] = await Promise.all([
			db.getSetMembers('pid:' + pid + ':upvote'),
			db.getSetMembers('pid:' + pid + ':downvote'),
		]);
		const upvoterSets = upvoters.map(uid => 'uid:' + uid + ':upvote');
		const downvoterSets = downvoters.map(uid => 'uid:' + uid + ':downvote');
		await Promise.all([
			db.sortedSetsRemove(upvoterSets.concat(downvoterSets), pid),
			db.deleteAll(['pid:' + pid + ':upvote', 'pid:' + pid + ':downvote']),
		]);
	}

	async function deletePostFromReplies(postData) {
		if (!parseInt(postData.toPid, 10)) {
			return;
		}
		await Promise.all([
			db.sortedSetRemove('pid:' + postData.toPid + ':replies', postData.pid),
			db.decrObjectField('post:' + postData.toPid, 'replies'),
		]);
	}

	async function deletePostFromGroups(postData) {
		if (!parseInt(postData.uid, 10)) {
			return;
		}
		const groupNames = await groups.getUserGroupMembership('groups:visible:createtime', [postData.uid]);
		const keys = groupNames[0].map(groupName => 'group:' + groupName + ':member:pids');
		await db.sortedSetsRemove(keys, postData.pid);
	}
};
