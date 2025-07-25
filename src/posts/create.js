'use strict';

const meta = require('../meta');
const db = require('../database');
const plugins = require('../plugins');
const user = require('../user');
const topics = require('../topics');
const categories = require('../categories');
const groups = require('../groups');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const utils = require('../utils');

module.exports = function (Posts) {
	Posts.create = async function (data) {
		// This is an internal method, consider using Topics.reply instead
		const { uid, tid, _activitypub, sourceContent } = data;
		const content = data.content.toString();
		const timestamp = data.timestamp || Date.now();
		const isMain = data.isMain || false;

		if (!uid && parseInt(uid, 10) !== 0) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (data.toPid) {
			await checkToPid(data.toPid, uid);
		}
		if (data.parentPid) {
			await checkParentPid(data.parentPid, uid, tid);
		}

		const pid = data.pid || await db.incrObjectField('global', 'nextPid');
		let postData = { pid, uid, tid, content, sourceContent, timestamp };

		if (data.toPid) {
			postData.toPid = data.toPid;
		}
		if (data.parentPid) {
			postData.parentPid = data.parentPid;
		}
		if (data.ip && meta.config.trackIpPerPost) {
			postData.ip = data.ip;
		}
		if (data.handle && !parseInt(uid, 10)) {
			postData.handle = data.handle;
		}
		if (_activitypub) {
			if (_activitypub.url) {
				postData.url = _activitypub.url;
			}
			if (_activitypub.audience) {
				postData.audience = _activitypub.audience;
			}
		}

		// Rewrite emoji references to inline image assets
		if (_activitypub && _activitypub.tag && Array.isArray(_activitypub.tag)) {
			_activitypub.tag
				.filter(tag => tag.type === 'Emoji' &&
					tag.icon && tag.icon.type === 'Image')
				.forEach((tag) => {
					if (!tag.name.startsWith(':')) {
						tag.name = `:${tag.name}`;
					}
					if (!tag.name.endsWith(':')) {
						tag.name = `${tag.name}:`;
					}

					postData.content = postData.content.replace(new RegExp(tag.name, 'g'), `<img class="not-responsive emoji" src="${tag.icon.url}" title="${tag.name}" />`);
				});
		}

		({ post: postData } = await plugins.hooks.fire('filter:post.create', { post: postData, data: data }));
		await db.setObject(`post:${postData.pid}`, postData);

		const topicData = await topics.getTopicFields(tid, ['cid', 'pinned']);
		postData.cid = topicData.cid;

		await Promise.all([
			db.sortedSetAdd('posts:pid', timestamp, postData.pid),
			utils.isNumber(pid) ? db.incrObjectField('global', 'postCount') : null,
			user.onNewPostMade(postData),
			topics.onNewPostMade(postData),
			categories.onNewPostMade(topicData.cid, topicData.pinned, postData),
			groups.onNewPostMade(postData),
			addReplyTo(postData, timestamp),
			Posts.uploads.sync(postData.pid),
		]);

		const result = await plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid });
		result.post.isMain = isMain;
		plugins.hooks.fire('action:post.save', { post: { ...result.post, _activitypub } });
		return result.post;
	};

	async function addReplyTo(postData, timestamp) {
		const promises = [];
		
		if (postData.toPid) {
			promises.push(
				db.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid),
				db.incrObjectField(`post:${postData.toPid}`, 'replies')
			);
		}
		
		if (postData.parentPid) {
			promises.push(
				db.sortedSetAdd(`pid:${postData.parentPid}:children`, timestamp, postData.pid),
				db.incrObjectField(`post:${postData.parentPid}`, 'replies')
			);
		}
		
		if (promises.length > 0) {
			await Promise.all(promises);
		}
	}

	async function checkToPid(toPid, uid) {
		if (!utils.isNumber(toPid) && !activitypub.helpers.isUri(toPid)) {
			throw new Error('[[error:invalid-pid]]');
		}

		const [toPost, canViewToPid] = await Promise.all([
			Posts.getPostFields(toPid, ['pid', 'deleted']),
			privileges.posts.can('posts:view_deleted', toPid, uid),
		]);
		const toPidExists = !!toPost.pid;
		if (!toPidExists || (toPost.deleted && !canViewToPid)) {
			throw new Error('[[error:invalid-pid]]');
		}
	}

	async function checkParentPid(parentPid, uid, tid) {
		if (!utils.isNumber(parentPid)) {
			throw new Error('[[error:invalid-pid]]');
		}

		const [parentPost, canViewParent] = await Promise.all([
			Posts.getPostFields(parentPid, ['pid', 'tid', 'deleted', 'parentPid']),
			privileges.posts.can('posts:view_deleted', parentPid, uid),
		]);
		
		const parentExists = !!parentPost.pid;
		if (!parentExists || (parentPost.deleted && !canViewParent)) {
			throw new Error('[[error:invalid-pid]]');
		}

		// Ensure parent post is in the same topic
		if (parseInt(parentPost.tid, 10) !== parseInt(tid, 10)) {
			throw new Error('[[error:parent-post-different-topic]]');
		}

		// Check for cycles and calculate depth
		const maxDepth = meta.config.threadingMaxDepth || 5;
		const depth = await calculateThreadDepth(parentPid);
		
		if (depth >= maxDepth) {
			throw new Error('[[error:thread-max-depth-exceeded]]');
		}
	}

	async function calculateThreadDepth(pid, visited = new Set()) {
		if (visited.has(pid)) {
			throw new Error('[[error:thread-cycle-detected]]');
		}
		
		visited.add(pid);
		const post = await Posts.getPostFields(pid, ['parentPid']);
		
		if (!post.parentPid || post.parentPid === 0) {
			return 1;
		}
		
		return 1 + await calculateThreadDepth(post.parentPid, visited);
	}
};
