'use strict';

const meta = require('../meta');
const db = require('../database');
const plugins = require('../plugins');
const user = require('../user');
const topics = require('../topics');
const categories = require('../categories');
const groups = require('../groups');
const activitypub = require('../activitypub');
const utils = require('../utils');

module.exports = function (Posts) {
	Posts.create = async function (data) {
		// This is an internal method, consider using Topics.reply instead
		const { uid, tid, _activitypub, sourceContent } = data;
		const content = data.content.toString();
		const timestamp = data.timestamp || Date.now();
		const isMain = data.isMain || false;
		let hasAttachment = false;

		if (!uid && parseInt(uid, 10) !== 0) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (data.toPid && !utils.isNumber(data.toPid) && !activitypub.helpers.isUri(data.toPid)) {
			throw new Error('[[error:invalid-pid]]');
		}

		const pid = data.pid || await db.incrObjectField('global', 'nextPid');
		let postData = { pid, uid, tid, content, sourceContent, timestamp };

		if (data.toPid) {
			postData.toPid = data.toPid;
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

						const property = postData.sourceContent && !postData.content ? 'sourceContent' : 'content';
						postData[property] = postData[property].replace(new RegExp(tag.name, 'g'), `<img class="not-responsive emoji" src="${tag.icon.url}" title="${tag.name}" />`);
					});
			}

			hasAttachment = _activitypub && _activitypub.attachment && _activitypub.attachment.length;
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
			Posts.uploads.sync(pid),
			hasAttachment ? Posts.attachments.update(pid, _activitypub.attachment) : null,
		]);

		const result = await plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid });
		result.post.isMain = isMain;
		plugins.hooks.fire('action:post.save', { post: { ...result.post, _activitypub } });
		return result.post;
	};

	async function addReplyTo(postData, timestamp) {
		if (!postData.toPid) {
			return;
		}
		await Promise.all([
			db.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid),
			db.incrObjectField(`post:${postData.toPid}`, 'replies'),
		]);
	}
};
